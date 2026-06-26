using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.AdmissaoPortal;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Frontend;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using RHPortal.Api.Domain.Entities;
using Xunit;

namespace RhPortal.Api.Tests.AdmissaoPortal;

public sealed class AdmissaoPortalRhNotificacaoServiceTests
{
    private const string TenantId = "tenant-admissao-notif";

    private static (AppDbContext Db, AdmissaoPortalRhNotificacaoService Svc, Mock<IEmailQueueService> EmailMock) CreateServices(
        IMemoryCache? cache = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var emailMock = new Mock<IEmailQueueService>();
        emailMock
            .Setup(x => x.EnqueueRawAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<bool>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EmailMessage { Id = Guid.NewGuid(), TenantId = TenantId });

        var frontendMock = new Mock<IFrontendPublicUrlBuilder>();
        frontendMock
            .Setup(x => x.BuildAbsoluteUrl(It.IsAny<string>()))
            .Returns<string>(path => $"https://app.test{path}");

        var db = new AppDbContext(options, tenantMock.Object);
        var svc = new AdmissaoPortalRhNotificacaoService(
            db,
            tenantMock.Object,
            emailMock.Object,
            frontendMock.Object,
            cache ?? new MemoryCache(new MemoryCacheOptions()),
            NullLogger<AdmissaoPortalRhNotificacaoService>.Instance);

        return (db, svc, emailMock);
    }

    [Fact]
    public async Task NotifyAtualizacaoAsync_EnfileiraEmailParaRecrutadorDaVaga()
    {
        var (db, svc, emailMock) = CreateServices();
        var analistaId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();
        var preAdmissaoId = Guid.NewGuid();

        db.Set<ApplicationUser>().Add(new ApplicationUser
        {
            Id = analistaId,
            TenantId = TenantId,
            Email = "analista.rh@test.local",
            FullName = "Ana RH",
            UserName = "analista.rh@test.local",
        });

        db.Set<Vaga>().Add(new Vaga
        {
            Id = vagaId,
            TenantId = TenantId,
            Titulo = "Analista de Marketing",
            RecrutadorResponsavelUserId = analistaId,
        });

        db.Set<Domain.Entities.PreAdmissao>().Add(new Domain.Entities.PreAdmissao
        {
            Id = preAdmissaoId,
            TenantId = TenantId,
            Nome = "João Silva",
            Cpf = "12345678901",
            VagaId = vagaId,
            Status = PreAdmissaoStatus.PreenchidoParcial,
            Email = "joao@test.local",
            Celular = "999999999",
            WizardCurrentStep = 2,
            WizardCompletionPercent = 40,
        });

        await db.SaveChangesAsync();

        await svc.NotifyAtualizacaoAsync(preAdmissaoId, "save_dados", CancellationToken.None);

        emailMock.Verify(
            x => x.EnqueueRawAsync(
                "analista.rh@test.local",
                It.Is<string>(s => s.Contains("João Silva")),
                It.Is<string>(body => body.Contains("João Silva") && body.Contains("Analista de Marketing") && body.Contains("✅")),
                null,
                true,
                "admissao-portal-atualizacao",
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task NotifyAtualizacaoAsync_RespeitaThrottleEmSaveDados()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var (db, svc, emailMock) = CreateServices(cache);
        var analistaId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();
        var preAdmissaoId = Guid.NewGuid();

        db.Set<ApplicationUser>().Add(new ApplicationUser
        {
            Id = analistaId,
            TenantId = TenantId,
            Email = "analista.rh@test.local",
            UserName = "analista.rh@test.local",
        });

        db.Set<Vaga>().Add(new Vaga
        {
            Id = vagaId,
            TenantId = TenantId,
            Titulo = "Cargo Teste",
            RecrutadorResponsavelUserId = analistaId,
        });

        db.Set<Domain.Entities.PreAdmissao>().Add(new Domain.Entities.PreAdmissao
        {
            Id = preAdmissaoId,
            TenantId = TenantId,
            Nome = "Maria",
            VagaId = vagaId,
            Status = PreAdmissaoStatus.PreenchidoParcial,
        });

        await db.SaveChangesAsync();

        await svc.NotifyAtualizacaoAsync(preAdmissaoId, "save_dados", CancellationToken.None);
        await svc.NotifyAtualizacaoAsync(preAdmissaoId, "save_dados", CancellationToken.None);

        emailMock.Verify(
            x => x.EnqueueRawAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<bool>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task NotifyAtualizacaoAsync_SubmitNaoUsaThrottle()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var (db, svc, emailMock) = CreateServices(cache);
        var analistaId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();
        var preAdmissaoId = Guid.NewGuid();

        db.Set<ApplicationUser>().Add(new ApplicationUser
        {
            Id = analistaId,
            TenantId = TenantId,
            Email = "analista.rh@test.local",
            UserName = "analista.rh@test.local",
        });

        db.Set<Vaga>().Add(new Vaga
        {
            Id = vagaId,
            TenantId = TenantId,
            Titulo = "Cargo Teste",
            RecrutadorResponsavelUserId = analistaId,
        });

        db.Set<Domain.Entities.PreAdmissao>().Add(new Domain.Entities.PreAdmissao
        {
            Id = preAdmissaoId,
            TenantId = TenantId,
            Nome = "Maria",
            VagaId = vagaId,
            Status = PreAdmissaoStatus.Preenchido,
        });

        await db.SaveChangesAsync();

        await svc.NotifyAtualizacaoAsync(preAdmissaoId, "save_dados", CancellationToken.None);
        await svc.NotifyAtualizacaoAsync(preAdmissaoId, "submit", CancellationToken.None);

        emailMock.Verify(
            x => x.EnqueueRawAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<bool>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }
}
