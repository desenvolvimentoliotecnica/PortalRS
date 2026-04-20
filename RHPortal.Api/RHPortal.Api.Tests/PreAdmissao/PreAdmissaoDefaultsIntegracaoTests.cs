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
}
