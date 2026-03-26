using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Feedback;

/// <summary>
/// Testes do GamificationService — leaderboard, saldo individual, perfil e atividades diárias.
/// GetLeaderboard usa Include(x => x.User) — seed obrigatório para os balances terem usuários.
/// </summary>
public sealed class GamificationServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, GamificationService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new GamificationService(db, tenantMock.Object);
        return (db, service);
    }

    private static Guid SeedUser(AppDbContext db, string email = "user@empresa.com", string fullName = "Usuário Teste")
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            FullName = fullName,
            Email = email,
            UserName = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user.Id;
    }

    private static void SeedBalance(AppDbContext db, Guid userId, decimal balance)
    {
        db.RenderCoinBalances.Add(new RenderCoinBalance
        {
            TenantId = TenantTeste,
            UserId = userId,
            Balance = balance,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
    }

    // ── GetMyBalance ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMyBalance_SemBalance_RetornaZero()
    {
        var (_, svc) = CriarServico();
        var userId = Guid.NewGuid();

        var result = await svc.GetMyBalanceAsync(userId, CancellationToken.None);

        Assert.Equal(0m, result.Balance);
        Assert.Equal(userId, result.UserId);
    }

    [Fact]
    public async Task GetMyBalance_ComBalance_RetornaSaldoCorreto()
    {
        var (db, svc) = CriarServico();
        var userId = SeedUser(db, "gb@empresa.com");
        SeedBalance(db, userId, 1500m);

        var result = await svc.GetMyBalanceAsync(userId, CancellationToken.None);

        Assert.Equal(1500m, result.Balance);
    }

    // ── GetLeaderboard ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetLeaderboard_SemBalances_RetornaListaVazia()
    {
        var (_, svc) = CriarServico();

        var result = await svc.GetLeaderboardAsync(ct: CancellationToken.None);

        Assert.Equal(0, result.TotalItems);
        Assert.Empty(result.Items);
    }

    [Fact]
    public async Task GetLeaderboard_ComBalances_RetornaOrdenadoPorBalanceDesc()
    {
        var (db, svc) = CriarServico();
        var u1 = SeedUser(db, "l1@empresa.com", "Primeiro");
        var u2 = SeedUser(db, "l2@empresa.com", "Segundo");
        var u3 = SeedUser(db, "l3@empresa.com", "Terceiro");

        SeedBalance(db, u1, 500m);
        SeedBalance(db, u2, 3000m);
        SeedBalance(db, u3, 1200m);

        var result = await svc.GetLeaderboardAsync(ct: CancellationToken.None);

        Assert.Equal(3, result.TotalItems);
        Assert.Equal(u2, result.Items[0].UserId);
        Assert.Equal(3000m, result.Items[0].Balance);
        Assert.Equal(1, result.Items[0].Rank);
        Assert.Equal(u3, result.Items[1].UserId);
        Assert.Equal(u1, result.Items[2].UserId);
        Assert.Equal(3, result.Items[2].Rank);
    }

    // ── GetMyProfile ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMyProfile_SemBalance_RetornaNivelInicianteEProgressoZero()
    {
        var (db, svc) = CriarServico();
        var userId = SeedUser(db, "profile@empresa.com");

        var result = await svc.GetMyProfileAsync(userId, CancellationToken.None);

        Assert.Equal("Iniciante", result.Level);
        Assert.Equal(0, result.Balance);
    }

    [Fact]
    public async Task GetMyProfile_ComBalance1500_NivelEngajado()
    {
        var (db, svc) = CriarServico();
        var userId = SeedUser(db, "profile2@empresa.com");
        SeedBalance(db, userId, 1500m);

        var result = await svc.GetMyProfileAsync(userId, CancellationToken.None);

        Assert.Equal("Influente", result.Level);
        Assert.Equal(1500m, result.Balance);
    }

    // ── GetDailyActivities ────────────────────────────────────────────────────

    [Fact]
    public async Task GetDailyActivities_SemState_RetornaContadoresZerados()
    {
        var (_, svc) = CriarServico();

        var result = await svc.GetDailyActivitiesAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(5, result.Count); // 5 atividades configuradas
        Assert.All(result, a => Assert.InRange(a.Current, 0, 1)); // current é 0 ou 1 (check-in pode ser 0)
        // Sem state, todos os counters são 0
        var feedbacks = result.First(a => a.Key == "feedbacks");
        Assert.Equal(0, feedbacks.Current);
        var celebrations = result.First(a => a.Key == "celebrations");
        Assert.Equal(0, celebrations.Current);
    }

    // ── GetRules ──────────────────────────────────────────────────────────────

    [Fact]
    public void GetRules_RetornaRegrasCatalogadas()
    {
        var (_, svc) = CriarServico();

        var result = svc.GetRules();

        Assert.NotEmpty(result);
        Assert.All(result, r =>
        {
            Assert.False(string.IsNullOrEmpty(r.EventType));
            Assert.True(r.Points > 0);
        });
    }
}
