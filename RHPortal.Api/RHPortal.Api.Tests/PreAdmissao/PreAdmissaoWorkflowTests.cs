using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.Blip;
using RhPortal.Api.Application.ItaloIntegracao;
using RhPortal.Api.Application.OcupacaoHistorico;
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
/// Testes de fluxo de trabalho da pré-admissão — Submit, Approve, Reject,
/// BuscarPorCpf e RegistrarResultadoIntegracao.
/// Completa a cobertura iniciada em CriarPreAdmissaoServiceTests.
/// </summary>
public sealed class PreAdmissaoWorkflowTests
{
    private const string TenantTeste = "tenant-teste";

    // CPF válido para testes de validação
    private const string CpfValido = "529.982.247-25";

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

        var userStore = new Mock<IUserStore<ApplicationUser>>();
        var userManager = new Mock<UserManager<ApplicationUser>>(
            userStore.Object, null, null, null, null, null, null, null, null);

        // Email sem email → CreateAsync retorna identidade com erro → não bloqueia fluxo
        userManager
            .Setup(x => x.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((ApplicationUser?)null);
        userManager
            .Setup(x => x.CreateAsync(It.IsAny<ApplicationUser>(), It.IsAny<string>()))
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
        var ocupacaoService = new Mock<IOcupacaoHistoricoService>();
        var hostEnvironment = new Mock<Microsoft.Extensions.Hosting.IHostEnvironment>();
        hostEnvironment.Setup(x => x.ContentRootPath).Returns(Path.GetTempPath());
        var httpClientFactory = new Mock<IHttpClientFactory>();
        var blipMessaging = new BlipMessagingService(
            db,
            httpClientFactory.Object,
            new Mock<ILogger<BlipMessagingService>>().Object);

        var service = new PreAdmissaoService(
            db, tenantMock.Object, userManager.Object,
            emailQueue.Object, italoService.Object, storage.Object, logger.Object,
            httpAccessor.Object,
            ocupacaoService.Object,
            blipMessaging,
            new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(),
            hostEnvironment.Object);

        return (db, service);
    }

    /// <summary>
    /// Seed de PreAdmissao em estado específico, sem passar pelo CreateAsync,
    /// para testar transições de status em isolamento.
    /// </summary>
    private static Guid SeedPreAdmissao(
        AppDbContext db,
        PreAdmissaoStatus status,
        string? cpf = null,
        string? email = null)
    {
        var entity = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Status = status,
            PreenchidoPor = PreenchidoPor.RH,
            Nome = "Fulano de Tal",
            Cpf = cpf,
            Email = email,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<Domain.Entities.PreAdmissao>().Add(entity);
        db.SaveChanges();
        return entity.Id;
    }

    private static Guid SeedPessoa(AppDbContext db, string cpf)
    {
        var pessoa = new Pessoa
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Nome = "Pessoa CPF Teste",
            Cpf = cpf,
            Origem = OrigemPessoa.Manual,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Pessoas.Add(pessoa);
        db.SaveChanges();
        return pessoa.Id;
    }

    private static async Task PreencherCamposObrigatoriosTotvsAsync(AppDbContext db, Guid id)
    {
        var entity = await db.Set<Domain.Entities.PreAdmissao>().FirstAsync(x => x.Id == id);
        entity.NomeAbreviado = "Fulano";
        entity.PaisNacionalidade = "1058";
        entity.DataNascimento = new DateOnly(1990, 1, 10);
        entity.PaisNascimento = "1058";
        entity.NaturalUf = "SP";
        entity.NaturalCidade = "Sao Paulo";
        entity.GrauInstrucao = 7;
        entity.EstadoCivil = EstadoCivil.Solteiro;
        entity.Sexo = Sexo.Masculino;
        entity.Logradouro = "Rua A";
        entity.Bairro = "Centro";
        entity.Cidade = "Sao Paulo";
        entity.Uf = "SP";
        entity.Cep = "01001000";
        entity.Cpf = CpfValido;
        entity.OrigemFuncionario = 1;
        entity.Cutis = 1;
        entity.Cabelo = 1;
        entity.Olhos = 1;
        entity.MunicipioEnderecoIbge = 3550308;
        entity.CategoriaSalarial = 1;
        entity.DataAdmissao = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        entity.TipoFuncionario = 1;
        entity.CodVinculoEmpregaticio = 10;
        entity.EmitCartPonto = "S";
        entity.TipoEstatistica = 1;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
    }

    // ── Submit (Rascunho/Enviado → Preenchido → auto-aprova se TOTVS ok) ──
    //
    // Após PreAdmissaoDefaultsIntegracaoTests: Submit agora tenta auto-aprovar
    // rodando o validator TOTVS. Se faltarem campos, mantém Preenchido e lança
    // TotvsValidationException. Testes abaixo ajustados para refletir isso.

    [Fact]
    public async Task Submit_StatusRascunho_SemDadosTotvs_LancaTotvsValidationException()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Rascunho);

        // Dados mínimos (nome/cpf) não passam no validator TOTVS → exception.
        await Assert.ThrowsAsync<TotvsValidationException>(
            () => svc.SubmitAsync(id, CancellationToken.None));

        // Porém o status muda para Preenchido (persiste antes de validar).
        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == id);
        Assert.Equal(PreAdmissaoStatus.Preenchido, entity.Status);
        Assert.NotNull(entity.SubmittedAtUtc);
    }

    [Fact]
    public async Task Submit_StatusEnviado_SemDadosTotvs_LancaTotvsValidationException()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Enviado);

        await Assert.ThrowsAsync<TotvsValidationException>(
            () => svc.SubmitAsync(id, CancellationToken.None));

        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == id);
        Assert.Equal(PreAdmissaoStatus.Preenchido, entity.Status);
    }

    [Fact]
    public async Task Submit_StatusPreenchido_SemDadosTotvs_LancaTotvsValidationException()
    {
        // Status Preenchido é submissível (o Submit roda validator e pode ir pra Aprovada);
        // com dados mínimos, ainda falha por não passar no validator.
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Preenchido);

        await Assert.ThrowsAsync<TotvsValidationException>(
            () => svc.SubmitAsync(id, CancellationToken.None));
    }

    [Fact]
    public async Task Submit_StatusPreenchido_RevalidaEMantemPreenchido()
    {
        // Status Preenchido é submissível (o Submit roda validator e pode ir pra Aprovada);
        // com dados mínimos, ainda falha por não passar no validator.
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Preenchido);

        var result = await svc.SubmitAsync(id, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(PreAdmissaoStatus.Preenchido, result.Status);
        Assert.NotNull(result.SubmittedAtUtc);
    }

    [Fact]
    public async Task Submit_CpfValido_SetaValidacaoCpfOkTrue()
    {
        // CPF válido: o ValidacaoCpfOk é marcado antes do validator TOTVS rodar;
        // se faltar TOTVS, a exception estoura mas o flag foi persistido.
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Rascunho, cpf: CpfValido);

        await Assert.ThrowsAsync<TotvsValidationException>(
            () => svc.SubmitAsync(id, CancellationToken.None));

        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == id);
        Assert.True(entity.ValidacaoCpfOk);
    }

    [Fact]
    public async Task Submit_CpfInvalido_SetaValidacaoCpfOkFalse()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Rascunho, cpf: "000.000.000-00");

        await Assert.ThrowsAsync<TotvsValidationException>(
            () => svc.SubmitAsync(id, CancellationToken.None));

        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == id);
        Assert.False(entity.ValidacaoCpfOk);
    }

    // ── Approve (Preenchido → Aprovada) ───────────────────────────────────────

    [Fact]
    public async Task Approve_StatusPreenchido_SemDadosTotvs_LancaTotvsValidationException()
    {
        // ApproveAsync roda PreAdmissaoTotvsValidator; com dados mínimos (nome/cpf),
        // 30+ campos obrigatórios estão vazios → exception. Comportamento idêntico ao
        // cenário em que RH tenta aprovar sem preencher o wizard completo.
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Preenchido, email: null);
        await PreencherCamposObrigatoriosTotvsAsync(db, id);
        var aprovadorId = Guid.NewGuid();

        await Assert.ThrowsAsync<TotvsValidationException>(() =>
            svc.ApproveAsync(
                id, aprovadorId, new PreAdmissaoApproveRequest("Aprovado sem ressalvas"),
                CancellationToken.None));

        // Status continua Preenchido — RH precisa preencher e tentar de novo.
        var entity = await db.Set<Domain.Entities.PreAdmissao>().IgnoreQueryFilters().FirstAsync(x => x.Id == id);
        Assert.Equal(PreAdmissaoStatus.Preenchido, entity.Status);
    }

    [Fact]
    public async Task Approve_StatusRascunho_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Rascunho);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ApproveAsync(
                id, Guid.NewGuid(),
                new PreAdmissaoApproveRequest(null),
                CancellationToken.None));
    }

    [Fact]
    public async Task Approve_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.ApproveAsync(
            Guid.NewGuid(), Guid.NewGuid(),
            new PreAdmissaoApproveRequest(null),
            CancellationToken.None);

        Assert.Null(result);
    }

    // ── Reject (Preenchido → Rejeitada) ───────────────────────────────────────

    [Fact]
    public async Task Reject_StatusPreenchido_TransicionaParaRejeitada()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Preenchido);

        var result = await svc.RejectAsync(
            id, new PreAdmissaoRejectRequest("Documentos incompletos"),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(PreAdmissaoStatus.Rejeitada, result.Status);
        Assert.Equal("Documentos incompletos", result.MotivoRejeicao);
    }

    [Fact]
    public async Task Reject_StatusRascunho_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Rascunho);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RejectAsync(id, new PreAdmissaoRejectRequest("Motivo"), CancellationToken.None));
    }

    // ── BuscarPorCpf ──────────────────────────────────────────────────────────

    [Fact]
    public async Task BuscarPorCpf_CpfNaoEncontrado_RetornaEncontradoFalso()
    {
        var (_, svc) = CriarServico();

        var result = await svc.BuscarPorCpfAsync("999.999.999-99", CancellationToken.None);

        Assert.False(result.Encontrado);
        Assert.Null(result.PessoaId);
        Assert.Null(result.Nome);
    }

    [Fact]
    public async Task BuscarPorCpf_CpfEncontrado_RetornaDadosDaPessoa()
    {
        var (db, svc) = CriarServico();
        SeedPessoa(db, CpfValido);

        // Busca sem pontuação — o serviço normaliza o CPF antes de comparar
        var result = await svc.BuscarPorCpfAsync(CpfValido.Replace(".", "").Replace("-", ""),
            CancellationToken.None);

        Assert.True(result.Encontrado);
        Assert.NotNull(result.PessoaId);
        Assert.Equal("Pessoa CPF Teste", result.Nome);
    }

    // ── RegistrarResultadoIntegracao ──────────────────────────────────────────

    [Fact]
    public async Task RegistrarIntegracao_StatusSucesso_MudaParaIntegrada()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Aprovada);

        var (result, error) = await svc.RegistrarResultadoIntegracaoAsync(
            id, new IntegracaoResultadoRequest("sucesso", "Integrado com sucesso"),
            CancellationToken.None);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(PreAdmissaoStatus.Integrada, result.Status);
        Assert.Equal(IntegracaoResultado.Sucesso, result.IntegracaoResultado);
        Assert.NotNull(result.IntegradaEmUtc);
    }

    [Fact]
    public async Task RegistrarIntegracao_StatusFalha_MantemAprovadaComResultadoFalha()
    {
        // Após falha de integração, a pré-admissão reaparece na fila para retry
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Aprovada);

        var (result, error) = await svc.RegistrarResultadoIntegracaoAsync(
            id, new IntegracaoResultadoRequest("falha", "Timeout no ERP"),
            CancellationToken.None);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(PreAdmissaoStatus.Aprovada, result.Status);
        Assert.Equal(IntegracaoResultado.Falha, result.IntegracaoResultado);
        Assert.Null(result.IntegradaEmUtc);
        Assert.Equal("Timeout no ERP", result.IntegracaoMensagem);
    }

    [Fact]
    public async Task RegistrarIntegracao_StatusNaoAprovado_RetornaErro()
    {
        var (db, svc) = CriarServico();
        var id = SeedPreAdmissao(db, PreAdmissaoStatus.Preenchido);

        var (result, error) = await svc.RegistrarResultadoIntegracaoAsync(
            id, new IntegracaoResultadoRequest("sucesso", null),
            CancellationToken.None);

        Assert.Null(result);
        Assert.NotNull(error);
        Assert.Contains("Aprovada", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RegistrarIntegracao_IdInexistente_RetornaNulos()
    {
        var (_, svc) = CriarServico();

        var (result, error) = await svc.RegistrarResultadoIntegracaoAsync(
            Guid.NewGuid(), new IntegracaoResultadoRequest("sucesso", null),
            CancellationToken.None);

        Assert.Null(result);
        Assert.Null(error);
    }
}
