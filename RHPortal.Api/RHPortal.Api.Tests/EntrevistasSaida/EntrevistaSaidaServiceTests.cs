using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.EntrevistasSaida;
using RhPortal.Api.Contracts.EntrevistasSaida;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Frontend;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;
using Xunit;

namespace RhPortal.Api.Tests.EntrevistasSaida;

public sealed class EntrevistaSaidaServiceTests
{
    private const string TenantId = "tenant-entrevista";

    private static (AppDbContext Db, EntrevistaSaidaService Svc, Mock<IEmailQueueService> EmailMock) CreateServices()
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
        var svc = new EntrevistaSaidaService(db, tenantMock.Object, emailMock.Object, frontendMock.Object);
        return (db, svc, emailMock);
    }

    private static async Task<(Guid SolicitacaoId, Guid FuncionarioId)> SeedSolicitacaoAsync(
        AppDbContext db,
        string? email = "colaborador@test.local")
    {
        var funcionarioId = Guid.NewGuid();
        var solicitacaoId = Guid.NewGuid();
        var solicitanteId = Guid.NewGuid();

        db.Set<Funcionario>().AddRange(
            new Funcionario
            {
                Id = solicitanteId,
                TenantId = TenantId,
                Name = "Solicitante",
                Email = "solicitante@test.local",
                Status = FuncionarioStatus.Active,
            },
            new Funcionario
            {
                Id = funcionarioId,
                TenantId = TenantId,
                Name = "Colaborador",
                Email = email,
                Status = FuncionarioStatus.Active,
            });

        db.SolicitacoesDesligamento.Add(new SolicitacaoDesligamento
        {
            Id = solicitacaoId,
            TenantId = TenantId,
            SolicitanteId = solicitanteId,
            FuncionarioId = funcionarioId,
            DataDesligamento = DateOnly.FromDateTime(DateTime.UtcNow),
            MotivoDesligamento = "Teste",
            Status = SolicitacaoStatus.Aprovada,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();
        return (solicitacaoId, funcionarioId);
    }

    [Fact]
    public async Task Seeder_CriaTemplatePadrao_Idempotente()
    {
        var (db, _, _) = CreateServices();

        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);
        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);

        var templates = await db.TemplatesEntrevistaSaida
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == TenantId && t.Ativo)
            .Include(t => t.Perguntas)
            .ToListAsync();

        Assert.Single(templates);
        Assert.Equal(EntrevistaSaidaTemplateSeeder.NomePadrao, templates[0].Nome);
        Assert.True(templates[0].Perguntas.Count >= 5);
    }

    [Fact]
    public async Task EnviarAsync_SemTemplate_RetornaSemTemplate()
    {
        var (db, svc, emailMock) = CreateServices();
        var (solicitacaoId, _) = await SeedSolicitacaoAsync(db);

        var result = await svc.EnviarAsync(solicitacaoId, default);

        Assert.Equal(EntrevistaSaidaEnvioResult.SemTemplate, result);
        emailMock.Verify(
            x => x.EnqueueRawAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<bool>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task EnviarAsync_SemEmail_RetornaSemEmail()
    {
        var (db, svc, _) = CreateServices();
        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);
        var (solicitacaoId, _) = await SeedSolicitacaoAsync(db, email: null);

        var result = await svc.EnviarAsync(solicitacaoId, default);

        Assert.Equal(EntrevistaSaidaEnvioResult.SemEmail, result);
    }

    [Fact]
    public async Task EnviarAsync_Sucesso_CriaEntrevistaEEnviaEmail()
    {
        var (db, svc, emailMock) = CreateServices();
        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);
        var (solicitacaoId, _) = await SeedSolicitacaoAsync(db);

        var result = await svc.EnviarAsync(solicitacaoId, default);

        Assert.Equal(EntrevistaSaidaEnvioResult.Sucesso, result);
        Assert.Equal(1, await db.EntrevistasSaida.CountAsync());
        emailMock.Verify(
            x => x.EnqueueRawAsync(
                "colaborador@test.local",
                It.IsAny<string>(),
                It.Is<string>(body => body.Contains("https://app.test/public/exit-interview/")),
                It.IsAny<string?>(),
                false,
                "entrevista-saida",
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task EnviarAsync_Idempotente_Pendente_ReenviaEmail()
    {
        var (db, svc, emailMock) = CreateServices();
        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);
        var (solicitacaoId, _) = await SeedSolicitacaoAsync(db);

        Assert.Equal(EntrevistaSaidaEnvioResult.Sucesso, await svc.EnviarAsync(solicitacaoId, default));
        Assert.Equal(EntrevistaSaidaEnvioResult.Sucesso, await svc.EnviarAsync(solicitacaoId, default));

        Assert.Equal(1, await db.EntrevistasSaida.CountAsync());
        emailMock.Verify(
            x => x.EnqueueRawAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<bool>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task ReenviarAsync_JaRespondida_RetornaJaRespondida()
    {
        var (db, svc, _) = CreateServices();
        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);
        var (solicitacaoId, funcionarioId) = await SeedSolicitacaoAsync(db);

        Assert.Equal(EntrevistaSaidaEnvioResult.Sucesso, await svc.EnviarAsync(solicitacaoId, default));

        var entrevista = await db.EntrevistasSaida.SingleAsync();
        entrevista.SubmittedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        var result = await svc.ReenviarAsync(solicitacaoId, default);
        Assert.Equal(EntrevistaSaidaEnvioResult.JaRespondida, result);
    }

    [Fact]
    public async Task GetStatusBatchAsync_RefleteEstados()
    {
        var (db, svc, _) = CreateServices();
        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);
        var (solicitacaoId, funcionarioId) = await SeedSolicitacaoAsync(db);

        var before = await svc.GetStatusBatchAsync([(solicitacaoId, funcionarioId)], default);
        Assert.Equal(EntrevistaSaidaStatusCode.NaoEnviada, before[solicitacaoId].Status);

        await svc.EnviarAsync(solicitacaoId, default);

        var after = await svc.GetStatusBatchAsync([(solicitacaoId, funcionarioId)], default);
        Assert.Equal(EntrevistaSaidaStatusCode.Enviada, after[solicitacaoId].Status);
        Assert.NotNull(after[solicitacaoId].EnviadaEmUtc);
    }

    [Fact]
    public async Task SubmitAsync_Sucesso_MarcaRespondida()
    {
        var (db, svc, _) = CreateServices();
        await EntrevistaSaidaTemplateSeeder.EnsureAsync(db, TenantId, default);
        var (solicitacaoId, _) = await SeedSolicitacaoAsync(db);

        Assert.Equal(EntrevistaSaidaEnvioResult.Sucesso, await svc.EnviarAsync(solicitacaoId, default));

        var entrevista = await db.EntrevistasSaida.SingleAsync();
        var perguntas = await db.PerguntasEntrevistaSaida
            .Where(p => p.TemplateId == entrevista.TemplateId)
            .ToListAsync();

        var resultado = await svc.SubmitAsync(
            entrevista.Token,
            perguntas.Select(p => new RespostaDto(p.Id, "ok", p.TipoResposta == TipoRespostaEntrevista.Escala ? 8 : null, null)).ToList(),
            default);

        Assert.Equal(EntrevistaSaidaResultado.Sucesso, resultado);

        var batch = await svc.GetStatusBatchAsync([(solicitacaoId, entrevista.FuncionarioId)], default);
        Assert.Equal(EntrevistaSaidaStatusCode.Respondida, batch[solicitacaoId].Status);
    }
}
