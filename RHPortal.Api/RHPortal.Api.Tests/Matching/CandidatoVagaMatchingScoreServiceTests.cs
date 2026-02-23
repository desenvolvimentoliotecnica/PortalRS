using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Matching;

public sealed class CandidatoVagaMatchingScoreServiceTests
{
    private const string TenantId = "test-tenant";

    private static (AppDbContext Db, ICandidatoVagaMatchingScoreService Service) CreateService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new CandidatoVagaMatchingScoreService(db, tenantMock.Object);
        return (db, service);
    }

    private static async Task SeedCandidatosAsync(AppDbContext db, params (Guid Id, string Nome, string Email)[] candidatos)
    {
        foreach (var (id, nome, email) in candidatos)
        {
            db.Candidatos.Add(new Candidato
            {
                Id = id,
                TenantId = TenantId,
                Nome = nome,
                Email = email,
                Fonte = CandidateOrigin.Site,
                Status = CandidateStatus.Novo,
            });
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task SaveAiScoreAsync_InsertsNewScore()
    {
        var (db, service) = CreateService();
        var candidatoId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();
        await SeedCandidatosAsync(db, (candidatoId, "Maria Silva", "maria@test.com"));

        await service.SaveAiScoreAsync(candidatoId, vagaId, 85, default);

        var saved = await db.CandidatoVagaMatchingScores
            .FirstOrDefaultAsync(x => x.CandidatoId == candidatoId && x.VagaId == vagaId);
        Assert.NotNull(saved);
        Assert.Equal(85, saved.Score);
        Assert.Equal(TenantId, saved.TenantId);
    }

    [Fact]
    public async Task SaveAiScoreAsync_UpdatesExistingScore()
    {
        var (db, service) = CreateService();
        var candidatoId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();
        await SeedCandidatosAsync(db, (candidatoId, "João Santos", "joao@test.com"));
        db.CandidatoVagaMatchingScores.Add(new CandidatoVagaMatchingScore
        {
            CandidatoId = candidatoId,
            VagaId = vagaId,
            Score = 50,
            CalculatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
            TenantId = TenantId,
        });
        await db.SaveChangesAsync();

        await service.SaveAiScoreAsync(candidatoId, vagaId, 90, default);

        var saved = await db.CandidatoVagaMatchingScores
            .FirstOrDefaultAsync(x => x.CandidatoId == candidatoId && x.VagaId == vagaId);
        Assert.NotNull(saved);
        Assert.Equal(90, saved.Score);
    }

    [Fact]
    public async Task GetRankingByVagaFromStoreAsync_ReturnsOrderedByScoreDesc()
    {
        var (db, service) = CreateService();
        var vagaId = Guid.NewGuid();
        var c1 = Guid.NewGuid();
        var c2 = Guid.NewGuid();
        var c3 = Guid.NewGuid();
        await SeedCandidatosAsync(db,
            (c1, "Ana Alta", "ana@test.com"),
            (c2, "Bruno Medio", "bruno@test.com"),
            (c3, "Carla Baixa", "carla@test.com"));

        await service.SaveAiScoreAsync(c1, vagaId, 70, default);
        await service.SaveAiScoreAsync(c2, vagaId, 90, default);
        await service.SaveAiScoreAsync(c3, vagaId, 60, default);

        var ranking = await service.GetRankingByVagaFromStoreAsync(vagaId, minScore: 0, take: 10, default);

        Assert.Equal(3, ranking.Count);
        Assert.Equal(90, ranking[0].Score);
        Assert.Equal("Bruno Medio", ranking[0].Nome);
        Assert.Equal(70, ranking[1].Score);
        Assert.Equal(60, ranking[2].Score);
    }

    [Fact]
    public async Task GetRankingByVagaFromStoreAsync_RespectsMinScoreAndTake()
    {
        var (db, service) = CreateService();
        var vagaId = Guid.NewGuid();
        var c1 = Guid.NewGuid();
        var c2 = Guid.NewGuid();
        var c3 = Guid.NewGuid();
        await SeedCandidatosAsync(db,
            (c1, "A", "a@test.com"),
            (c2, "B", "b@test.com"),
            (c3, "C", "c@test.com"));
        await service.SaveAiScoreAsync(c1, vagaId, 80, default);
        await service.SaveAiScoreAsync(c2, vagaId, 65, default);
        await service.SaveAiScoreAsync(c3, vagaId, 40, default);

        var ranking = await service.GetRankingByVagaFromStoreAsync(vagaId, minScore: 70, take: 1, default);

        Assert.Single(ranking);
        Assert.Equal(80, ranking[0].Score);
    }

    [Fact]
    public async Task ReplaceScoresForVagaAsync_RemovesOldAndInsertsNew()
    {
        var (db, service) = CreateService();
        var vagaId = Guid.NewGuid();
        var c1 = Guid.NewGuid();
        var c2 = Guid.NewGuid();
        await SeedCandidatosAsync(db, (c1, "X", "x@test.com"), (c2, "Y", "y@test.com"));
        await service.SaveAiScoreAsync(c1, vagaId, 10, default);

        await service.ReplaceScoresForVagaAsync(vagaId, new List<(Guid, int)>
        {
            (c1, 95),
            (c2, 70),
        }, TenantId, default);

        var ranking = await service.GetRankingByVagaFromStoreAsync(vagaId, 0, 10, default);
        Assert.Equal(2, ranking.Count);
        Assert.Equal(95, ranking[0].Score);
        Assert.Equal(70, ranking[1].Score);
    }
}
