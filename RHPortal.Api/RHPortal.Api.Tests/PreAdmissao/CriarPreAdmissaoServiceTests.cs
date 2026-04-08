using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.ItaloIntegracao;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using Xunit;

namespace RhPortal.Api.Tests.PreAdmissao;

/// <summary>
/// Testes de criação de pré-admissão — garante que CreateAsync persiste corretamente
/// a entidade com todos os campos do modelo (incluindo os campos de integração TOTVS
/// adicionados na migration 20260324000000_AddCamposIntegracaoPreAdmissao).
/// </summary>
public sealed class CriarPreAdmissaoServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, PreAdmissaoService Service) CriarServico(string tenantId = TenantTeste)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        var userStore = new Mock<IUserStore<Domain.Entities.ApplicationUser>>();
        var userManager = new Mock<UserManager<Domain.Entities.ApplicationUser>>(
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
            httpAccessor.Object);

        return (db, service);
    }

    private static PreAdmissaoCreateRequest RequestMinimo(
        string nome = "Ana Silva",
        string? cpf = "529.982.247-25") =>
        new(
            PreenchidoPor: PreenchidoPor.RH,
            CandidatoId: null,
            Nome: nome,
            Cpf: cpf);

    // ── testes ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComDadosMinimos_RetornaDetalheComIdValido()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo(), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Ana Silva", result.Nome);
    }

    [Fact]
    public async Task Create_StatusInicial_EhRascunho()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo(), CancellationToken.None);

        Assert.Equal(PreAdmissaoStatus.Rascunho, result.Status);
    }

    [Fact]
    public async Task Create_CamposIntegracaoTotvs_SaoNulosAoCriar()
    {
        // Garante que IntegracaoResultado, IntegracaoMensagem e IntegradaEmUtc
        // (adicionados pela migration 20260324000000_AddCamposIntegracaoPreAdmissao)
        // são null no momento da criação, sem causar erro de colunas ausentes.
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo(), CancellationToken.None);

        Assert.Null(result.IntegracaoResultado);
        Assert.Null(result.IntegracaoMensagem);
        Assert.Null(result.IntegradaEmUtc);
    }

    [Fact]
    public async Task Create_TenantId_PreenchidoDoContexto()
    {
        var tenantId = "meu-tenant";
        var (db, svc) = CriarServico(tenantId);

        var result = await svc.CreateAsync(RequestMinimo(), CancellationToken.None);

        var entity = await db.Set<Domain.Entities.PreAdmissao>()
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == result.Id);
        Assert.Equal(tenantId, entity.TenantId);
    }

    [Fact]
    public async Task Create_NomeTrimado_AoSalvar()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo(nome: "  Carlos Souza  "), CancellationToken.None);

        Assert.Equal("Carlos Souza", result.Nome);
    }

    [Fact]
    public async Task Create_CpfNulo_NaoCausaErro()
    {
        var (_, svc) = CriarServico();

        var result = await svc.CreateAsync(RequestMinimo(cpf: null), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Null(result.Cpf);
    }

    [Fact]
    public async Task Create_PersistidaNoDb_PodeSerRecuperadaPorId()
    {
        var (_, svc) = CriarServico();

        var created = await svc.CreateAsync(RequestMinimo(), CancellationToken.None);
        var retrieved = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(retrieved);
        Assert.Equal(created.Id, retrieved.Id);
        Assert.Equal(PreAdmissaoStatus.Rascunho, retrieved.Status);
    }

    [Fact]
    public async Task Create_MultiplasCriacoes_IsoladasPorId()
    {
        var (_, svc) = CriarServico();

        var r1 = await svc.CreateAsync(RequestMinimo(nome: "Alice"), CancellationToken.None);
        var r2 = await svc.CreateAsync(RequestMinimo(nome: "Bob"), CancellationToken.None);

        Assert.NotEqual(r1.Id, r2.Id);
        Assert.Equal("Alice", r1.Nome);
        Assert.Equal("Bob", r2.Nome);
    }
}
