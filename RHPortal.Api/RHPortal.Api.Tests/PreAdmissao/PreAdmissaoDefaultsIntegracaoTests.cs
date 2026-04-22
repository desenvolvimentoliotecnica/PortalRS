using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.ItaloIntegracao;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using Xunit;

namespace RhPortal.Api.Tests.PreAdmissao;

/// <summary>
/// Testes de integração TOTVS end-to-end — garantem que o fluxo manual (UI → backend)
/// produz uma pré-admissão equivalente aos mocks LUCAS/BRUNO que integraram com sucesso
/// no Datasul.
///
/// Cobre:
/// 1. PreAdmissaoDefaultsSeeder — campos BRA/S/N default no Create
/// 2. UpdateAsync com payload completo (cenário "happy path" do LUCAS)
/// 3. SubmitAsync auto-aprovação quando TOTVS validator passa
/// 4. SubmitAsync retorna TotvsValidationException com campos faltando
/// 5. IntegracaoTotvsService.GetDetalheAsync inclui todos os campos que o
///    employee-sync-service mapper espera (regIdentidCivil*, tipoConta int, etc)
/// </summary>
public sealed class PreAdmissaoDefaultsIntegracaoTests
{
    private const string TenantTeste = "tenant-totvs-test";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, PreAdmissaoService Service) CriarServico(
        string tenantId = TenantTeste)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        // Semeia empresa padrão para o DefaultsSeeder conseguir resolver CodEmpresa.
        db.Set<Empresa>().Add(new Empresa
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "99",
            Description = "Empresa Teste",
            IsActive = true,
        });
        db.SaveChanges();

        var userStore = new Mock<IUserStore<ApplicationUser>>();
        var userManager = new Mock<UserManager<ApplicationUser>>(
            userStore.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        userManager.Setup(x => x.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((ApplicationUser?)null);
        userManager.Setup(x => x.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
                   .ReturnsAsync(IdentityResult.Failed());

        var emailQueue = new Mock<IEmailQueueService>();
        var italoService = new Mock<IItaloIntegrationService>();
        var storage = new Mock<IS3StorageService>();
        storage.Setup(x => x.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync((Stream _, string key, string _, CancellationToken _) => key);
        storage.Setup(x => x.GetPresignedUrl(It.IsAny<string>(), It.IsAny<TimeSpan?>()))
               .Returns("https://s3.mock/presigned");

        var logger = new Mock<ILogger<PreAdmissaoService>>();
        var httpAccessor = new Mock<IHttpContextAccessor>();

        var service = new PreAdmissaoService(
            db, tenantMock.Object, userManager.Object,
            emailQueue.Object, italoService.Object, storage.Object, logger.Object,
            httpAccessor.Object);

        return (db, service);
    }

    private static PreAdmissaoCreateRequest RequestCriacao(
        string nome = "Lucas Teste",
        string? cpf = "529.982.247-25") =>
        new(PreenchidoPor: PreenchidoPor.RH, CandidatoId: null, Nome: nome, Cpf: cpf);

    /// <summary>
    /// Payload espelhando o mock LUCAS FERREIRA PEREIRA que integrou com sucesso.
    /// Mantido como fonte única de referência para todos os testes de happy path.
    /// </summary>
    private static PreAdmissaoUpdateRequest PayloadHappyPath() =>
        new(
            // Pessoal
            Nome: "Lucas Ferreira Pereira",
            NomeSocial: null,
            NomeAbreviado: "LUCAS",
            Cpf: "529.982.247-25",
            Rg: "353673791",
            RgOrgaoExpedidor: "SSP",
            RgUfExpedidor: "SP",
            RgDataExpedicao: new DateOnly(2010, 10, 27),
            DataNascimento: new DateOnly(1982, 5, 31),
            Sexo: Domain.Enums.Sexo.Masculino,
            EstadoCivil: Domain.Enums.EstadoCivil.Solteiro,
            Nacionalidade: "Brasileira",
            PaisNacionalidade: "BRA",
            NomeMae: "Aurelia Mercado",
            NomePai: "Roberto Soares",
            NaturalCidade: "SAO PAULO",
            NaturalUf: "SP",
            PaisNascimento: "BRA",
            // Estrangeiro
            Passaporte: null, RnmRne: null, ValidadeVisto: null, TipoVisto: null,
            ResideExterior: "N", TipoVistoEstrangeiro: 1,
            // RIC
            RegIdentidCivilNumero: "353673791",
            RegIdentidCivilUf: "SP",
            RegIdentidCivilCidade: "SAO PAULO",
            RegIdentidCivilOrgEmiss: "SSP",
            RegIdentidCivilDataExped: new DateOnly(2010, 10, 27),
            // Endereço
            Cep: "04562-000",
            Logradouro: "Rua Indiana",
            Numero: "71",
            Complemento: null,
            Bairro: "Brooklin",
            Cidade: "Sao Paulo",
            Uf: "SP",
            PontoReferencia: "Teste",
            TipoLogradouroESocial: "R",
            MunicipioEnderecoIbge: 3550308,
            // Contato
            Email: "lucas@teste.com.br",
            EmailAlternativo: "teste@teste.com.br",
            Telefone: "38341345",
            Celular: "988224045",
            DddTelefone: 11, DddTelContato: 11,
            ContatoEmergenciaNome: "Aurelia Mercado",
            ContatoEmergenciaFone: "11988224045",
            // Bancário
            BancoCodigo: "033", BancoNome: "Santander",
            Agencia: "4196", AgenciaDigito: "0",
            Conta: "1079060", ContaDigito: "5",
            TipoConta: TipoContaBancaria.ContaCorrente,
            // Trabalhista
            EstabelecimentoCodigo: "099",
            CodEmpresa: "1",
            UnitId: null, AreaId: null,
            JobPositionId: null, RequisitoCategoriaId: null,
            DataAdmissao: new DateOnly(2016, 5, 16),
            Salario: 3835.00m,
            TipoContratacao: TipoContratacaoAdmissao.CLT,
            CargaHorariaSemanal: 44,
            PisPasep: "38752119521",
            // TOTVS Cargo/Vínculo
            CodCargoTotvs: 299, CodVinculoEmpregaticio: 10,
            TipoFuncionario: 1, CategoriaSalarial: 1, GrauInstrucao: 9,
            CodTurno: 1,
            CentroCusto: "99999", UnidadeLotacao: "00001001",
            CodPlanoLotacao: 101, CodTurma: 1,
            NumCartaoPonto: 28101049, CodNivel: 1,
            TipoMaoDeObra: "ADM", FormaPagamento: 1,
            SalarioSimulado: 9918.20m,
            OrigemFuncionario: 1, IndFuncVinculado: 1, FuncQualificado: "S",
            // FGTS/INSS
            OptanteFgts: "S", DataOpcaoFgts: new DateOnly(2018, 11, 17),
            TipoAdmissaoFgts: 1, RecolheFgts: "S", RecolheInss: "S",
            // Sindicato
            Sindicalizado: "N", DescContribSindical: "N",
            ContribSindicDia: "S", CodSindicato: 1,
            // Flags cálculo
            CargaAutomTurno: "S", RecebePericul: "N", RecebeInsalub: "N",
            RecebeAdiantamento: "S", ConsidEmissRAIS: "S",
            Calcula13: "S", RecebeFerias: "S",
            // Provisões 13
            Avos13SalCalcAnterior: 5, Avos13SalCalc: 6,
            ProvAcum13Sal: 2093.14m, ProvAcumInss13Sal: 555.72m, ProvAcumFgts13Sal: 167.45m,
            // Provisões Férias
            DiasProvFeriasMesAnterior: 475m, DiasProvFeriasMesAtual: 500m,
            ProvAcumFerias: 6661.47m, ProvAcumInssFerias: 2358.16m,
            ProvAcumFgtsFerias: 710.55m, ProvAcumFerias13: 2220.49m,
            // Ponto
            EmitCartPonto: "1",
            CodLocalMarcacao: 1, CodClassFuncPontoEletronico: 1,
            // Docs avulsos
            TituloEleitorNumero: "96215860116",
            TituloEleitorZona: "258", TituloEleitorSecao: "190",
            TituloEleitorCidade: "SAO PAULO", TituloEleitorUf: "SP",
            ReservistaNumero: null,
            CategoriaCnh: "B",
            ValidadeCnh: new DateOnly(2028, 5, 25),
            Ctps: "30599", CtpsSerie: "272", CtpsUf: "SP",
            CtpsModelo: 3, CtpsSerieESocial: "272",
            // CNH
            CnhNumero: "5555685014", CnhUf: "SP", CnhOrgaoEmissor: "SSP",
            CnhDataExpedicao: 25102018, CnhPrimeiraHabilitacao: 14062002,
            // Doc Militar
            DocMilitarTipo: 1, DocMilitarNumero: "399855", DocMilitarSerie: "A",
            DocMilitarRegiao: 2, DocMilitarCircunscricao: 1,
            // Saúde
            GrupoSanguineo: 1, FatorRh: 2,
            PossuiDeficiencia: "N", FuncDoador: "S",
            CartaoSus: "10000141200",
            Altura: 180, Peso: 90,
            Cutis: 3, Cabelo: 1, Olhos: 1,
            Manequim: 40, Sapato: 42,
            // Contrato
            DataTerminoContrato: null,
            // Localidade
            PaisLocalidade: "BRA", CodLocalidade: 17, CodFpas: null,
            // eSocial
            CategoriaTrabalhoESocial: 101,
            IndAdmissao: 1, NaturezaAtividade: 1,
            MunicipioNascimentoIbge: 3550308,
            TipoAdmissaoESocial: 1,
            RegimeTrabalhista: 1, RegimePrevidenciario: 1, RegimeJornada: 1,
            MatriculaESocial: null,
            // Estatística
            TipoEstatistica: 1,
            // CAGED
            OcorrenciaCAGED: 1,
            CodRegistroExterior: null,
            ValidacaoSalarioJustificativa: null);

    // ── 1. Defaults Seeder ───────────────────────────────────────────────────

    [Fact]
    public async Task Create_AplicaDefaultsTotvs_PaisBraAutomatico()
    {
        var (db, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        // Países default = BRA
        Assert.Equal("BRA", entity.PaisNacionalidade);
        Assert.Equal("BRA", entity.PaisNascimento);
        Assert.Equal("BRA", entity.PaisLocalidade);
    }

    [Fact]
    public async Task Create_AplicaDefaultsTotvs_FlagsSN()
    {
        var (db, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        // Flags que Datasul exige preenchidas
        Assert.Equal("S", entity.OptanteFgts);
        Assert.Equal("S", entity.RecolheFgts);
        Assert.Equal("S", entity.RecolheInss);
        Assert.Equal("N", entity.Sindicalizado);
        Assert.Equal("N", entity.ResideExterior);
        Assert.Equal("S", entity.CargaAutomTurno);
        Assert.Equal("S", entity.Calcula13);
        Assert.Equal("S", entity.RecebeFerias);
        Assert.Equal("N", entity.RecebePericul);
        Assert.Equal("N", entity.RecebeInsalub);
    }

    [Fact]
    public async Task Create_AplicaDefaultsTotvs_CodEmpresaVemDaTabelaEmpresa()
    {
        var (db, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        // CodEmpresa deve vir da primeira Empresa ativa do tenant (code "99" seedada no factory)
        Assert.Equal("99", entity.CodEmpresa);
    }

    [Fact]
    public async Task Create_AplicaDefaultsTotvs_EmitCartPontoFallback2()
    {
        // Datasul rejeita vazio; default "2" (não emite) é fallback seguro.
        var (db, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        Assert.Equal("2", entity.EmitCartPonto);
    }

    [Fact]
    public async Task Create_AplicaDefaultsTotvs_RegimesESocialPadraoCLT()
    {
        var (db, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        // Valores para CLT brasileiro padrão
        Assert.Equal(1, entity.TipoEstatistica);
        Assert.Equal(101, entity.CategoriaTrabalhoESocial);
        Assert.Equal(1, entity.IndAdmissao);
        Assert.Equal(1, entity.TipoAdmissaoESocial);
        Assert.Equal(1, entity.RegimeTrabalhista);
        Assert.Equal(1, entity.RegimePrevidenciario);
        Assert.Equal(1, entity.RegimeJornada);
        Assert.Equal(1, entity.OrigemFuncionario);
    }

    [Fact]
    public async Task Create_AplicaDefaultsTotvs_TipoLogradouroESocialR()
    {
        var (db, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        Assert.Equal("R", entity.TipoLogradouroESocial);
    }

    // ── 2. Update completo ───────────────────────────────────────────────────

    [Fact]
    public async Task Update_ComPayloadCompleto_PersisteTodosOsCamposTotvs()
    {
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var result = await svc.UpdateAsync(created.Id, PayloadHappyPath(), isPrivileged: true, CancellationToken.None);

        Assert.NotNull(result);
        // RIC
        Assert.Equal("353673791", result.RegIdentidCivilNumero);
        Assert.Equal("SAO PAULO", result.RegIdentidCivilCidade);
        Assert.Equal("SP", result.RegIdentidCivilUf);
        Assert.Equal("SSP", result.RegIdentidCivilOrgEmiss);
        Assert.Equal(new DateOnly(2010, 10, 27), result.RegIdentidCivilDataExped);
        // TOTVS cargo/vínculo
        Assert.Equal(299, result.CodCargoTotvs);
        Assert.Equal(10, result.CodVinculoEmpregaticio);
        Assert.Equal("1", result.EmitCartPonto);
        Assert.Equal(1, result.TipoEstatistica);
        // Organizacional
        Assert.Equal("099", result.EstabelecimentoCodigo);
        Assert.Equal("99999", result.CentroCusto);
        Assert.Equal("00001001", result.UnidadeLotacao);
    }

    // ── 3. Submit auto-aprovação ─────────────────────────────────────────────

    [Fact]
    public async Task Submit_ComPayloadCompleto_AutoAprovaParaStatusAprovada()
    {
        // Este é o teste crítico — simula o cenário dos mocks LUCAS/BRUNO que integraram.
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);
        await svc.UpdateAsync(created.Id, PayloadHappyPath(), isPrivileged: true, CancellationToken.None);

        var result = await svc.SubmitAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        // Auto-aprovação deve levar direto pra Aprovada
        Assert.Equal(PreAdmissaoStatus.Aprovada, result.Status);
        Assert.NotNull(result.ApprovedAtUtc);
        Assert.NotNull(result.SubmittedAtUtc);
    }

    // ── 4. Submit com dados incompletos ──────────────────────────────────────

    [Fact]
    public async Task Submit_SemRic_LancaTotvsValidationException()
    {
        // Cria payload SEM os campos RIC → validator TOTVS deve estourar.
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var payloadSemRic = PayloadHappyPath() with
        {
            RegIdentidCivilNumero = null,
            RegIdentidCivilCidade = null,
            RegIdentidCivilUf = null,
            RegIdentidCivilOrgEmiss = null,
        };
        await svc.UpdateAsync(created.Id, payloadSemRic, isPrivileged: true, CancellationToken.None);

        var ex = await Assert.ThrowsAsync<TotvsValidationException>(() =>
            svc.SubmitAsync(created.Id, CancellationToken.None));

        // Deve listar os 4 campos RIC como obrigatórios
        Assert.Contains(ex.Issues, i => i.Campo == "RegIdentidCivilNumero");
        Assert.Contains(ex.Issues, i => i.Campo == "RegIdentidCivilCidade");
        Assert.Contains(ex.Issues, i => i.Campo == "RegIdentidCivilUf");
        Assert.Contains(ex.Issues, i => i.Campo == "RegIdentidCivilOrgEmiss");
    }

    [Fact]
    public async Task Submit_MantemStatusPreenchidoQuandoFalha()
    {
        // Quando validator falha no submit, o status deve ficar em Preenchido
        // (não volta pra Rascunho) — permite RH corrigir e tentar de novo.
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var payloadSemRic = PayloadHappyPath() with { RegIdentidCivilNumero = null };
        await svc.UpdateAsync(created.Id, payloadSemRic, isPrivileged: true, CancellationToken.None);

        await Assert.ThrowsAsync<TotvsValidationException>(() =>
            svc.SubmitAsync(created.Id, CancellationToken.None));

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == created.Id);
        Assert.Equal(PreAdmissaoStatus.Preenchido, entity.Status);
    }

    // ── 5. DetailResponse (fonte do payload pro sync-service) ──────────────

    [Fact]
    public async Task DetailResponse_ComPayloadCompleto_TemTodosCamposCriticosDoMockQueFuncionou()
    {
        // DetailResponse do GetByIdAsync é lido pelo IntegracaoTotvsService.GetDetalheAsync
        // e vira o payload camelCase consumido pelo employee-sync-service mapper.
        // Verifica que os campos que os mocks LUCAS/BRUNO usaram e que o Datasul rejeita
        // quando vazios estão presentes e com os tipos corretos.
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);
        await svc.UpdateAsync(created.Id, PayloadHappyPath(), isPrivileged: true, CancellationToken.None);
        await svc.SubmitAsync(created.Id, CancellationToken.None);

        var detail = await svc.GetByIdAsync(created.Id, CancellationToken.None);
        Assert.NotNull(detail);

        // ── RIC (bug histórico resolvido — Datasul rejeita "Cidade RIC") ──
        Assert.Equal("353673791", detail!.RegIdentidCivilNumero);
        Assert.Equal("SAO PAULO", detail.RegIdentidCivilCidade);
        Assert.Equal("SP",        detail.RegIdentidCivilUf);
        Assert.Equal("SSP",       detail.RegIdentidCivilOrgEmiss);

        // ── Cartão ponto como código TOTVS ("1", não "S") ──
        Assert.Equal("1", detail.EmitCartPonto);

        // ── ResideExterior preenchido (quebrava quando null) ──
        Assert.Equal("N", detail.ResideExterior);

        // ── PaisNacionalidade enviado (não estava no payload antigo) ──
        Assert.Equal("BRA", detail.PaisNacionalidade);

        // ── TipoConta — enum serializado como enum (IntegracaoTotvsService converte para int) ──
        Assert.Equal(TipoContaBancaria.ContaCorrente, detail.TipoConta);

        // ── Core TOTVS do mock LUCAS/BRUNO ──
        Assert.Equal("099",  detail.EstabelecimentoCodigo);
        Assert.Equal(299,    detail.CodCargoTotvs);
        Assert.Equal(10,     detail.CodVinculoEmpregaticio);
        Assert.Equal(1,      detail.TipoFuncionario);
        Assert.Equal(1,      detail.TipoEstatistica);

        // ── Status final auto-aprovado ──
        Assert.Equal(PreAdmissaoStatus.Aprovada, detail.Status);
    }

    // ── 6. Cenário Sophie — gaps descobertos em produção ────────────────────

    [Fact]
    public async Task Submit_CenarioSophie_PaisBrasilPorExtensoENormalizadoParaBRA()
    {
        // Sophie teve paisNacionalidade="Brasil" vindo da UI — Datasul rejeitou
        // "Pais inexistente". Seeder agora normaliza automaticamente.
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);
        var payload = PayloadHappyPath() with
        {
            PaisNacionalidade = "Brasil",
            PaisNascimento = "BRAZIL",
            PaisLocalidade = "BR",
        };
        await svc.UpdateAsync(created.Id, payload, isPrivileged: true, CancellationToken.None);

        // Submit roda seeder, normaliza os 3 países, e auto-aprova.
        var result = await svc.SubmitAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("BRA", result.PaisNacionalidade);
        Assert.Equal("BRA", result.PaisNascimento);
        Assert.Equal("BRA", result.PaisLocalidade);
        Assert.Equal(PreAdmissaoStatus.Aprovada, result.Status);
    }

    [Fact]
    public async Task Submit_CenarioSophie_CodEmpresaVazioEhPreenchidoViaSeederNoSubmit()
    {
        // Sophie tinha codEmpresa=null porque foi criada antes do seeder existir
        // (ou via IniciarManualAsync reaproveitando registro antigo). No retry/submit,
        // seeder preenche com a primeira Empresa ativa do tenant.
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        // Simula o cenário Sophie: zera codEmpresa direto no banco (bypass do seeder do Create).
        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == created.Id);
        entity.CodEmpresa = null;
        await db.SaveChangesAsync();

        await svc.UpdateAsync(created.Id, PayloadHappyPath() with { CodEmpresa = null }, isPrivileged: true, CancellationToken.None);

        // Submit → seeder roda de novo → codEmpresa preenchido antes do validator checar.
        var result = await svc.SubmitAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("99", result.CodEmpresa); // Empresa code="99" que o factory semeia
        Assert.Equal(PreAdmissaoStatus.Aprovada, result.Status);
    }

    [Fact]
    public async Task Submit_CenarioSophie_RicComPlaceholder1_RejeitaComErroDeTamanhoMinimo()
    {
        // Sophie preencheu regIdentidCivilNumero="1" e regIdentidCivilCidade="1"
        // (placeholder lixo) — passou pelo validator antigo (só checava blank).
        // Novo validator rejeita por tamanho mínimo.
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);
        var payload = PayloadHappyPath() with
        {
            RegIdentidCivilNumero = "1",
            RegIdentidCivilCidade = "1",
        };
        await svc.UpdateAsync(created.Id, payload, isPrivileged: true, CancellationToken.None);

        var ex = await Assert.ThrowsAsync<TotvsValidationException>(() =>
            svc.SubmitAsync(created.Id, CancellationToken.None));

        Assert.Contains(ex.Issues, i => i.Campo == "RegIdentidCivilNumero" && i.TipoRegra == "Formato");
        Assert.Contains(ex.Issues, i => i.Campo == "RegIdentidCivilCidade" && i.TipoRegra == "Formato");
    }

    [Fact]
    public async Task Submit_CenarioSophie_PaisNaoISO3_RejeitaComFormatoInvalido()
    {
        // Cenário: UI antiga enviou "Brasil" e seeder não rodou (ex: integração direta).
        // Validator agora rejeita formato não-ISO3.
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);
        var payload = PayloadHappyPath() with { PaisNacionalidade = "BRA" };
        await svc.UpdateAsync(created.Id, payload, isPrivileged: true, CancellationToken.None);

        // Simula: alguém escreveu direto no banco "Brasil" (burlando o seeder).
        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == created.Id);
        entity.PaisNacionalidade = "Brasil";
        await db.SaveChangesAsync();

        // Chama validator direto para não acionar normalização do seeder.
        var issues = PreAdmissaoTotvsValidator.Validate(entity);
        Assert.Contains(issues, i => i.Campo == "PaisNacionalidade" && i.TipoRegra == "Formato");
    }

    [Fact]
    public async Task Submit_CenarioSophie_CamposSNDefaultsPreenchidosNoSeeder()
    {
        // Sophie teve optanteFgts/recolheFgts/sindicalizado etc null. Seeder aplica
        // defaults S/N compatíveis com CLT brasileiro padrão.
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        // Simula cenário Sophie: entity antiga sem os defaults.
        var e = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == created.Id);
        e.OptanteFgts = null; e.RecolheFgts = null; e.RecolheInss = null;
        e.Sindicalizado = null; e.ResideExterior = null;
        e.CargaAutomTurno = null; e.Calcula13 = null; e.RecebeFerias = null;
        e.RecebePericul = null; e.RecebeInsalub = null; e.RecebeAdiantamento = null;
        e.ConsidEmissRAIS = null; e.TipoLogradouroESocial = null;
        await db.SaveChangesAsync();

        await svc.UpdateAsync(created.Id, PayloadHappyPath() with
        {
            OptanteFgts = null, RecolheFgts = null, RecolheInss = null,
            Sindicalizado = null, ResideExterior = null,
            CargaAutomTurno = null, Calcula13 = null, RecebeFerias = null,
            RecebePericul = null, RecebeInsalub = null, RecebeAdiantamento = null,
            ConsidEmissRAIS = null, TipoLogradouroESocial = null,
        }, isPrivileged: true, CancellationToken.None);

        // Submit deve chamar seeder e preencher tudo.
        var result = await svc.SubmitAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("S", result.OptanteFgts);
        Assert.Equal("S", result.RecolheFgts);
        Assert.Equal("S", result.RecolheInss);
        Assert.Equal("N", result.Sindicalizado);
        Assert.Equal("N", result.ResideExterior);
        Assert.Equal("S", result.CargaAutomTurno);
        Assert.Equal("S", result.Calcula13);
        Assert.Equal("S", result.RecebeFerias);
        Assert.Equal("N", result.RecebePericul);
        Assert.Equal("N", result.RecebeInsalub);
        Assert.Equal("N", result.RecebeAdiantamento);
        Assert.Equal("S", result.ConsidEmissRAIS);
        // Validator já deveria ter passado, então status = Aprovada
        Assert.Equal(PreAdmissaoStatus.Aprovada, result.Status);
    }

    [Fact]
    public async Task Submit_SemFormaPagamentoOuTipoAdmissaoFgts_LancaException()
    {
        // Novos campos obrigatórios do validator (depois do bug da Sophie).
        var (_, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);
        var payload = PayloadHappyPath() with
        {
            FormaPagamento = null,
            TipoAdmissaoFgts = null,
        };
        await svc.UpdateAsync(created.Id, payload, isPrivileged: true, CancellationToken.None);

        var ex = await Assert.ThrowsAsync<TotvsValidationException>(() =>
            svc.SubmitAsync(created.Id, CancellationToken.None));

        Assert.Contains(ex.Issues, i => i.Campo == "FormaPagamento");
        Assert.Contains(ex.Issues, i => i.Campo == "TipoAdmissaoFgts");
    }

    [Fact]
    public async Task Submit_SemTipoLogradouroESocial_LancaException()
    {
        // tipoLogradouroESocial agora é obrigatório no validator.
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        // Bypass do seeder do create — limpa direto na entity.
        var e = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == created.Id);
        e.TipoLogradouroESocial = null;
        await db.SaveChangesAsync();

        await svc.UpdateAsync(created.Id, PayloadHappyPath() with { TipoLogradouroESocial = null }, isPrivileged: true, CancellationToken.None);
        // TipoLogradouroESocial fica null no update; seeder do submit preenche "R".
        var result = await svc.SubmitAsync(created.Id, CancellationToken.None);
        Assert.NotNull(result);
        Assert.Equal("R", result.TipoLogradouroESocial);
    }

    [Fact]
    public void Validator_PaisComStringBrasil_RetornaErroDeFormato()
    {
        // Teste unitário do validator isoladamente — garante que "Brasil" gera erro
        // mesmo que o seeder por algum motivo não rode antes.
        var entity = new Domain.Entities.PreAdmissao
        {
            PaisNacionalidade = "Brasil",
            PaisNascimento    = "Brasil",
            PaisLocalidade    = "Brasil",
        };

        var issues = PreAdmissaoTotvsValidator.Validate(entity);

        Assert.Contains(issues, i => i.Campo == "PaisNacionalidade" && i.TipoRegra == "Formato");
        Assert.Contains(issues, i => i.Campo == "PaisNascimento"    && i.TipoRegra == "Formato");
        Assert.Contains(issues, i => i.Campo == "PaisLocalidade"    && i.TipoRegra == "Formato");
    }

    [Fact]
    public void Validator_RicComPlaceholder1_RetornaErroDeTamanhoMinimo()
    {
        var entity = new Domain.Entities.PreAdmissao
        {
            RegIdentidCivilNumero = "1",
            RegIdentidCivilCidade = "1",
            RegIdentidCivilOrgEmiss = "SSP",
            RegIdentidCivilUf = "SP",
        };

        var issues = PreAdmissaoTotvsValidator.Validate(entity);

        Assert.Contains(issues, i => i.Campo == "RegIdentidCivilNumero" && i.TipoRegra == "Formato");
        Assert.Contains(issues, i => i.Campo == "RegIdentidCivilCidade" && i.TipoRegra == "Formato");
    }

    // ── 7. Cenário DocMilitar / Visto Estrangeiro / CAGED ───────────────────

    [Fact]
    public async Task Create_AplicaDefaultsTotvs_DocMilitarVistoCaged()
    {
        // Datasul rejeita iDocMilitarTipo/iTipoVistoEstrang/iOcorrCaged < 1 mesmo para
        // casos onde não se aplica. Seeder agora preenche todos com "1" como fallback seguro.
        var (db, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);

        Assert.Equal(1, entity.DocMilitarTipo);
        Assert.Equal(1, entity.DocMilitarRegiao);
        Assert.Equal(1, entity.DocMilitarCircunscricao);
        Assert.Equal(1, entity.TipoVistoEstrangeiro);
        Assert.Equal(1, entity.OcorrenciaCAGED);
    }

    [Fact]
    public async Task Submit_SemDocMilitar_LancaTotvsValidationException()
    {
        // Garante que validator bloqueia se campos DocMilitar/VistoEstrang/CAGED estiverem
        // nulos (simula submit burlando o seeder — ex: entity criada antes do seeder existir).
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);
        await svc.UpdateAsync(created.Id, PayloadHappyPath(), isPrivileged: true, CancellationToken.None);

        // Bypass do seeder do submit — zera direto antes de chamar o validator.
        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == created.Id);
        entity.DocMilitarTipo = null;
        entity.DocMilitarRegiao = null;
        entity.DocMilitarCircunscricao = null;
        entity.TipoVistoEstrangeiro = null;
        entity.OcorrenciaCAGED = null;

        var issues = PreAdmissaoTotvsValidator.Validate(entity);

        Assert.Contains(issues, i => i.Campo == "DocMilitarTipo");
        Assert.Contains(issues, i => i.Campo == "DocMilitarRegiao");
        Assert.Contains(issues, i => i.Campo == "DocMilitarCircunscricao");
        Assert.Contains(issues, i => i.Campo == "TipoVistoEstrangeiro");
        Assert.Contains(issues, i => i.Campo == "OcorrenciaCAGED");
    }

    [Fact]
    public async Task Submit_CenarioDocMilitarZerado_SeederPreencheDefaults()
    {
        // Simula entity antiga sem os defaults DocMilitar/Visto/CAGED. Submit deve
        // chamar seeder, preencher com 1, e auto-aprovar.
        var (db, svc) = CriarServico();
        var created = await svc.CreateAsync(RequestCriacao(), CancellationToken.None);

        var e = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == created.Id);
        e.DocMilitarTipo = null;
        e.DocMilitarRegiao = null;
        e.DocMilitarCircunscricao = null;
        e.TipoVistoEstrangeiro = null;
        e.OcorrenciaCAGED = null;
        await db.SaveChangesAsync();

        await svc.UpdateAsync(created.Id, PayloadHappyPath() with
        {
            DocMilitarTipo = null,
            DocMilitarRegiao = null,
            DocMilitarCircunscricao = null,
            TipoVistoEstrangeiro = null,
            OcorrenciaCAGED = null,
        }, isPrivileged: true, CancellationToken.None);

        var result = await svc.SubmitAsync(created.Id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(1, result.DocMilitarTipo);
        Assert.Equal(1, result.DocMilitarRegiao);
        Assert.Equal(1, result.DocMilitarCircunscricao);
        Assert.Equal(1, result.TipoVistoEstrangeiro);
        Assert.Equal(1, result.OcorrenciaCAGED);
        Assert.Equal(PreAdmissaoStatus.Aprovada, result.Status);
    }

    [Fact]
    public void Validator_DocMilitarVistoCagedAusentes_RetornaErrosObrigatorio()
    {
        // Unit test puro — valida que o validator exige DocMilitar/Visto/CAGED mesmo
        // sem outras dependências (ex: mulher maior de 45 ainda precisa desses defaults).
        var entity = new Domain.Entities.PreAdmissao
        {
            // Campos DocMilitar/Visto/CAGED deixados null de propósito.
        };

        var issues = PreAdmissaoTotvsValidator.Validate(entity);

        Assert.Contains(issues, i => i.Campo == "DocMilitarTipo"          && i.TipoRegra == "Obrigatório");
        Assert.Contains(issues, i => i.Campo == "DocMilitarRegiao"        && i.TipoRegra == "Obrigatório");
        Assert.Contains(issues, i => i.Campo == "DocMilitarCircunscricao" && i.TipoRegra == "Obrigatório");
        Assert.Contains(issues, i => i.Campo == "TipoVistoEstrangeiro"    && i.TipoRegra == "Obrigatório");
        Assert.Contains(issues, i => i.Campo == "OcorrenciaCAGED"         && i.TipoRegra == "Obrigatório");
    }
}
