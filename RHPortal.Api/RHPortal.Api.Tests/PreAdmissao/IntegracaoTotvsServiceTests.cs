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
/// Testes de integração do fluxo TOTVS Progress Datasul:
/// - ListPendentesIntegracao   → fila de Aprovadas para o Node.js (Gabriel)
/// - RegistrarResultado Sucesso → status vira Integrada, sai da fila
/// - RegistrarResultado Falha   → mantém Aprovada, volta para a fila (retry)
/// - ListPainelIntegracao       → painel por tenant com filtros
/// - OwnerListPainelIntegracao  → visão cross-tenant do Owner
/// </summary>
public sealed class IntegracaoTotvsServiceTests
{
    private const string TenantA = "tenant-a";
    private const string TenantB = "tenant-b";

    // ── factory helpers ──────────────────────────────────────────────────────

    private static (AppDbContext Db, PreAdmissaoService Service) CreateService(string tenantId = TenantA)
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
            db,
            tenantMock.Object,
            userManager.Object,
            emailQueue.Object,
            italoService.Object,
            storage.Object,
            logger.Object,
            httpAccessor.Object,
            new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());

        return (db, service);
    }

    /// <summary>Insere uma PreAdmissao diretamente no banco, ignorando o query filter.</summary>
    private static Domain.Entities.PreAdmissao SeedPreAdmissao(
        AppDbContext db,
        string tenantId,
        PreAdmissaoStatus status,
        DateTimeOffset? approvedAtUtc = null,
        IntegracaoResultado? integracaoResultado = null,
        string? integracaoMensagem = null,
        DateTimeOffset? integradaEmUtc = null)
    {
        var entity = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Nome = $"Colaborador {Guid.NewGuid():N}".Substring(0, 20),
            Cpf = "529.982.247-25",
            Status = status,
            PreenchidoPor = PreenchidoPor.RH,
            CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-5),
            UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
            ApprovedAtUtc = approvedAtUtc ?? (status >= PreAdmissaoStatus.Aprovada ? DateTimeOffset.UtcNow.AddDays(-1) : null),
            IntegracaoResultado = integracaoResultado,
            IntegracaoMensagem = integracaoMensagem,
            IntegradaEmUtc = integradaEmUtc,
        };
        db.Set<Domain.Entities.PreAdmissao>().Add(entity);
        db.SaveChanges();
        return entity;
    }

    // ── ListPendentesIntegracaoAsync ─────────────────────────────────────────

    [Fact]
    public async Task ListPendentes_RetornaApenasAprovadas_DoTenantCorreto()
    {
        var (db, service) = CreateService(TenantA);

        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Preenchido);      // não aparece
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Integrada);      // não aparece
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Aprovada);       // outro tenant

        var resultado = await service.ListPendentesIntegracaoAsync(CancellationToken.None);

        Assert.Single(resultado);
        Assert.Equal(aprovada.Id, resultado[0].Id);
        Assert.Equal(PreAdmissaoStatus.Aprovada, resultado[0].Status);
    }

    [Fact]
    public async Task ListPendentes_OrdemFIFO_PorApprovedAtUtc()
    {
        var (db, service) = CreateService(TenantA);

        var primeira = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada,
            approvedAtUtc: DateTimeOffset.UtcNow.AddDays(-3));
        var segunda  = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada,
            approvedAtUtc: DateTimeOffset.UtcNow.AddDays(-2));
        var terceira = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada,
            approvedAtUtc: DateTimeOffset.UtcNow.AddDays(-1));

        var resultado = await service.ListPendentesIntegracaoAsync(CancellationToken.None);

        Assert.Equal(3, resultado.Count);
        Assert.Equal(primeira.Id, resultado[0].Id);
        Assert.Equal(segunda.Id,  resultado[1].Id);
        Assert.Equal(terceira.Id, resultado[2].Id);
    }

    [Fact]
    public async Task ListPendentes_QuandoNenhumaAprovada_RetornaListaVazia()
    {
        var (db, service) = CreateService(TenantA);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Integrada);

        var resultado = await service.ListPendentesIntegracaoAsync(CancellationToken.None);

        Assert.Empty(resultado);
    }

    // ── RegistrarResultadoIntegracaoAsync — SUCESSO ──────────────────────────

    [Fact]
    public async Task RegistrarResultado_Sucesso_MudaStatusParaIntegrada()
    {
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);

        var request = new IntegracaoResultadoRequest("sucesso", "Matrícula 00123 criada no Progress");
        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(aprovada.Id, request, CancellationToken.None);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(PreAdmissaoStatus.Integrada, result!.Status);
        Assert.Equal(IntegracaoResultado.Sucesso, result.IntegracaoResultado);
        Assert.Equal("Matrícula 00123 criada no Progress", result.IntegracaoMensagem);
        Assert.NotNull(result.IntegradaEmUtc);
    }

    [Fact]
    public async Task RegistrarResultado_Sucesso_SaiDaFila()
    {
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);

        await service.RegistrarResultadoIntegracaoAsync(
            aprovada.Id,
            new IntegracaoResultadoRequest("sucesso", null),
            CancellationToken.None);

        var pendentes = await service.ListPendentesIntegracaoAsync(CancellationToken.None);
        Assert.Empty(pendentes);
    }

    [Fact]
    public async Task RegistrarResultado_Sucesso_CaseInsensitive()
    {
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);

        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(
            aprovada.Id,
            new IntegracaoResultadoRequest("SUCESSO", null),
            CancellationToken.None);

        Assert.Null(error);
        Assert.Equal(PreAdmissaoStatus.Integrada, result!.Status);
    }

    // ── RegistrarResultadoIntegracaoAsync — FALHA ────────────────────────────

    [Fact]
    public async Task RegistrarResultado_Falha_MantemStatusAprovada()
    {
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);

        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(
            aprovada.Id,
            new IntegracaoResultadoRequest("falha", "Timeout ao conectar no Progress"),
            CancellationToken.None);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(PreAdmissaoStatus.Aprovada, result!.Status);
        Assert.Equal(IntegracaoResultado.Falha, result.IntegracaoResultado);
        Assert.Equal("Timeout ao conectar no Progress", result.IntegracaoMensagem);
        Assert.Null(result.IntegradaEmUtc);
    }

    [Fact]
    public async Task RegistrarResultado_Falha_SaiDaFilaAteRetryManual()
    {
        // Comportamento documentado em PreAdmissaoService.ListPendentesIntegracaoAsync:
        // após Falha/FalhaDefinitiva, o registro sai da fila (IntegracaoResultado != null)
        // e só volta via POST /api/integracao-totvs/{tipo}/{id}/retry (que zera o resultado).
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);

        await service.RegistrarResultadoIntegracaoAsync(
            aprovada.Id,
            new IntegracaoResultadoRequest("falha", "Erro no Progress"),
            CancellationToken.None);

        var pendentes = await service.ListPendentesIntegracaoAsync(CancellationToken.None);
        Assert.Empty(pendentes);
    }

    [Fact]
    public async Task RegistrarResultado_AposMultiplasFalhas_PodemRegistrarSucesso()
    {
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        var ct = CancellationToken.None;

        await service.RegistrarResultadoIntegracaoAsync(aprovada.Id, new("falha", "Erro 1"), ct);
        await service.RegistrarResultadoIntegracaoAsync(aprovada.Id, new("falha", "Erro 2"), ct);
        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(aprovada.Id, new("sucesso", "OK na 3ª tentativa"), ct);

        Assert.Null(error);
        Assert.Equal(PreAdmissaoStatus.Integrada, result!.Status);
        Assert.Equal(IntegracaoResultado.Sucesso, result.IntegracaoResultado);
        Assert.Equal("OK na 3ª tentativa", result.IntegracaoMensagem);
    }

    // ── RegistrarResultadoIntegracaoAsync — casos de erro ────────────────────

    [Fact]
    public async Task RegistrarResultado_IdNaoEncontrado_RetornaNullSemErro()
    {
        var (_, service) = CreateService(TenantA);

        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(
            Guid.NewGuid(),
            new IntegracaoResultadoRequest("sucesso", null),
            CancellationToken.None);

        Assert.Null(result);
        Assert.Null(error); // null, null → controller devolve 404
    }

    [Fact]
    public async Task RegistrarResultado_StatusNaoAprovada_RetornaErro()
    {
        var (db, service) = CreateService(TenantA);
        var integrada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Integrada);

        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(
            integrada.Id,
            new IntegracaoResultadoRequest("sucesso", null),
            CancellationToken.None);

        Assert.Null(result);
        Assert.NotNull(error);
        Assert.Contains("Aprovada", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RegistrarResultado_TenantErrado_NaoEncontraRegistro()
    {
        var (dbA, _)        = CreateService(TenantA);
        var (_, serviceB)   = CreateService(TenantB);

        var aprovadaA = SeedPreAdmissao(dbA, TenantA, PreAdmissaoStatus.Aprovada);

        // serviceB não deve enxergar o registro do TenantA
        var (result, error) = await serviceB.RegistrarResultadoIntegracaoAsync(
            aprovadaA.Id,
            new IntegracaoResultadoRequest("sucesso", null),
            CancellationToken.None);

        Assert.Null(result);
        Assert.Null(error); // 404
    }

    // ── ListPainelIntegracaoAsync ─────────────────────────────────────────────

    [Fact]
    public async Task ListPainel_RetornaAprovadas_E_Integradas_DoTenant()
    {
        var (db, service) = CreateService(TenantA);

        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Integrada, integracaoResultado: IntegracaoResultado.Sucesso);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Preenchido);     // não aparece
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Rejeitada);     // não aparece
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Aprovada);      // outro tenant

        var resultado = await service.ListPainelIntegracaoAsync(null, CancellationToken.None);

        Assert.Equal(2, resultado.Count);
    }

    [Fact]
    public async Task ListPainel_FiltroSucesso_RetornaApenasIntegradas()
    {
        var (db, service) = CreateService(TenantA);

        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);   // sem resultado (pendente)
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada,    // falha
            integracaoResultado: IntegracaoResultado.Falha);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Integrada,   // sucesso
            integracaoResultado: IntegracaoResultado.Sucesso);

        var resultado = await service.ListPainelIntegracaoAsync(IntegracaoResultado.Sucesso, CancellationToken.None);

        Assert.Single(resultado);
        Assert.Equal(IntegracaoResultado.Sucesso, resultado[0].IntegracaoResultado);
    }

    [Fact]
    public async Task ListPainel_FiltroFalha_RetornaApenasComFalha()
    {
        var (db, service) = CreateService(TenantA);

        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);   // sem resultado
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada,    // falha
            integracaoResultado: IntegracaoResultado.Falha);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Integrada,
            integracaoResultado: IntegracaoResultado.Sucesso);

        var resultado = await service.ListPainelIntegracaoAsync(IntegracaoResultado.Falha, CancellationToken.None);

        Assert.Single(resultado);
        Assert.Equal(IntegracaoResultado.Falha, resultado[0].IntegracaoResultado);
    }

    // ── OwnerListPainelIntegracaoAsync ────────────────────────────────────────

    [Fact]
    public async Task OwnerListPainel_SemFiltro_RetornaTodosOsTenants()
    {
        // Owner usa TenantA como "contexto" mas enxerga todos via IgnoreQueryFilters
        var (db, service) = CreateService(TenantA);

        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Aprovada);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Integrada, integracaoResultado: IntegracaoResultado.Sucesso);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Preenchido); // não aparece

        var resultado = await service.OwnerListPainelIntegracaoAsync(null, null, CancellationToken.None);

        Assert.Equal(3, resultado.Count);
        Assert.Contains(resultado, r => r.TenantId == TenantA);
        Assert.Contains(resultado, r => r.TenantId == TenantB);
    }

    [Fact]
    public async Task OwnerListPainel_FiltroTenant_RetornaApenasEsseTenant()
    {
        var (db, service) = CreateService(TenantA);

        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Aprovada);

        var resultado = await service.OwnerListPainelIntegracaoAsync(TenantB, null, CancellationToken.None);

        Assert.Single(resultado);
        Assert.Equal(TenantB, resultado[0].TenantId);
    }

    [Fact]
    public async Task OwnerListPainel_FiltroResultado_RetornaApenasComFalha()
    {
        var (db, service) = CreateService(TenantA);

        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada,
            integracaoResultado: IntegracaoResultado.Falha);
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Aprovada,
            integracaoResultado: IntegracaoResultado.Falha);
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Integrada,
            integracaoResultado: IntegracaoResultado.Sucesso);

        var resultado = await service.OwnerListPainelIntegracaoAsync(null, IntegracaoResultado.Falha, CancellationToken.None);

        Assert.Equal(2, resultado.Count);
        Assert.All(resultado, r => Assert.Equal(IntegracaoResultado.Falha, r.IntegracaoResultado));
    }

    [Fact]
    public async Task OwnerListPainel_TenantAContexto_NaoLimitaResultados()
    {
        // Garante que o query filter global (TenantId == contextual) está sendo
        // ignorado corretamente pelo IgnoreQueryFilters() no método Owner.
        var (db, service) = CreateService(TenantA);  // contexto é TenantA

        // Insere apenas registros do TenantB
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Aprovada);
        SeedPreAdmissao(db, TenantB, PreAdmissaoStatus.Integrada, integracaoResultado: IntegracaoResultado.Sucesso);

        var resultado = await service.OwnerListPainelIntegracaoAsync(null, null, CancellationToken.None);

        // Deve retornar os 2 registros do TenantB mesmo com contexto TenantA
        Assert.Equal(2, resultado.Count);
        Assert.All(resultado, r => Assert.Equal(TenantB, r.TenantId));
    }

    // ── Fluxo completo ponta-a-ponta ─────────────────────────────────────────

    [Fact]
    public async Task FluxoCompleto_Aprovada_Pendente_Sucesso_Integrada()
    {
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        var ct = CancellationToken.None;

        // 1. Aparece na fila de pendentes
        var pendentes = await service.ListPendentesIntegracaoAsync(ct);
        Assert.Single(pendentes);
        Assert.Equal(aprovada.Id, pendentes[0].Id);

        // 2. Aparece no painel sem resultado
        var painel = await service.ListPainelIntegracaoAsync(null, ct);
        Assert.Single(painel);
        Assert.Null(painel[0].IntegracaoResultado);

        // 3. Reporta sucesso
        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(
            aprovada.Id, new("sucesso", "OK"), ct);
        Assert.Null(error);
        Assert.Equal(PreAdmissaoStatus.Integrada, result!.Status);

        // 4. Sai da fila de pendentes
        var pendentesApos = await service.ListPendentesIntegracaoAsync(ct);
        Assert.Empty(pendentesApos);

        // 5. Ainda aparece no painel como Integrada com Sucesso
        var painelApos = await service.ListPainelIntegracaoAsync(null, ct);
        Assert.Single(painelApos);
        Assert.Equal(PreAdmissaoStatus.Integrada, painelApos[0].Status);
        Assert.Equal(IntegracaoResultado.Sucesso, painelApos[0].IntegracaoResultado);
        Assert.NotNull(painelApos[0].IntegradaEmUtc);
    }

    [Fact]
    public async Task FluxoCompleto_Falha_EntaoSucesso_ComRetry()
    {
        // Comportamento real (documentado em ListPendentesIntegracaoAsync):
        // - Falha: IntegracaoResultado=Falha, sai da fila
        // - Fica no painel com resultado Falha
        // - Para tentar de novo, registra outro resultado (sucesso) — não precisa retry
        //   porque RegistrarResultado aceita nova tentativa enquanto status=Aprovada.
        var (db, service) = CreateService(TenantA);
        var aprovada = SeedPreAdmissao(db, TenantA, PreAdmissaoStatus.Aprovada);
        var ct = CancellationToken.None;

        // 1ª tentativa: falha
        await service.RegistrarResultadoIntegracaoAsync(aprovada.Id, new("falha", "Timeout"), ct);

        // Falha tira da fila até retry manual
        var filaAposFalha = await service.ListPendentesIntegracaoAsync(ct);
        Assert.Empty(filaAposFalha);

        // No painel com resultado Falha
        var painelFalha = await service.ListPainelIntegracaoAsync(IntegracaoResultado.Falha, ct);
        Assert.Single(painelFalha);

        // 2ª tentativa: sucesso — RegistrarResultado aceita enquanto status=Aprovada
        var (result, error) = await service.RegistrarResultadoIntegracaoAsync(
            aprovada.Id, new("sucesso", "OK no retry"), ct);
        Assert.Null(error);
        Assert.Equal(PreAdmissaoStatus.Integrada, result!.Status);

        // Fora da fila
        var filaFinal = await service.ListPendentesIntegracaoAsync(ct);
        Assert.Empty(filaFinal);

        // No painel como Sucesso
        var painelSucesso = await service.ListPainelIntegracaoAsync(IntegracaoResultado.Sucesso, ct);
        Assert.Single(painelSucesso);
        Assert.Equal("OK no retry", painelSucesso[0].IntegracaoMensagem);
    }
}
