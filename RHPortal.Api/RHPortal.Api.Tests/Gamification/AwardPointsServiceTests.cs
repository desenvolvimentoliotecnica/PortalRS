using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Gamification;

public sealed class AwardPointsServiceTests
{
    private const string TenantId = "test-tenant";

    private static (AppDbContext Db, AwardPointsService Service) CreateService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantId);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new AwardPointsService(db, tenantMock.Object);
        return (db, service);
    }

    private static async Task<Guid> SeedUserAsync(AppDbContext db)
    {
        var userId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            TenantId = TenantId,
            UserName = $"user-{userId:N}",
            NormalizedUserName = $"USER-{userId:N}".ToUpperInvariant(),
            Email = $"user-{userId:N}@test.local",
            NormalizedEmail = $"user-{userId:N}@test.local".ToUpperInvariant(),
            FullName = "Usuário Teste",
            IsActive = true,
            SecurityStamp = Guid.NewGuid().ToString("N"),
            ConcurrencyStamp = Guid.NewGuid().ToString("N"),
        });
        await db.SaveChangesAsync();
        return userId;
    }

    [Fact]
    public async Task AwardAsync_DailyLogin_IsIdempotentByBusinessDay()
    {
        var (db, service) = CreateService();
        var userId = await SeedUserAsync(db);

        var first = await service.AwardAsync(userId, GamificationEventTypes.DailyLogin, reason: "Login diário");
        var second = await service.AwardAsync(userId, GamificationEventTypes.DailyLogin, reason: "Login diário");

        Assert.True(first.Awarded);
        Assert.False(second.Awarded);

        var txs = await db.RenderCoinTransactions.Where(x => x.UserId == userId && x.SourceType == GamificationEventTypes.DailyLogin).ToListAsync();
        Assert.Single(txs);

        var state = await db.GamificationDailyStates.SingleAsync(x => x.UserId == userId);
        Assert.Equal(1, state.CurrentStreak);
        Assert.Equal(1, state.BestStreak);
    }

    [Fact]
    public async Task AwardAsync_RespectsDailyCap_ForFeedbackSent()
    {
        var (db, service) = CreateService();
        var userId = await SeedUserAsync(db);

        var awarded = 0;
        for (var i = 0; i < 25; i++)
        {
            var result = await service.AwardAsync(
                userId,
                GamificationEventTypes.FeedbackSent,
                sourceId: $"feedback-{i}",
                reason: "Enviar feedback");
            if (result.Awarded) awarded++;
        }

        Assert.Equal(20, awarded);
        var txCount = await db.RenderCoinTransactions.CountAsync(x => x.UserId == userId && x.SourceType == GamificationEventTypes.FeedbackSent);
        Assert.Equal(20, txCount);
    }

    [Fact]
    public async Task AwardAsync_UpdatesBalanceAndCounters()
    {
        var (db, service) = CreateService();
        var userId = await SeedUserAsync(db);

        await service.AwardAsync(userId, GamificationEventTypes.CelebrationPost, sourceId: "post-1", reason: "Publicar celebração");
        await service.AwardAsync(userId, GamificationEventTypes.CelebrationComment, sourceId: "comment-1", reason: "Comentar em celebração");

        var balance = await db.RenderCoinBalances.SingleAsync(x => x.UserId == userId);
        Assert.Equal(10m, balance.Balance); // 8 + 2

        var state = await db.GamificationDailyStates.SingleAsync(x => x.UserId == userId);
        Assert.Equal(1, state.CelebrationPostsToday);
        Assert.Equal(1, state.CelebrationCommentsToday);
    }
}
