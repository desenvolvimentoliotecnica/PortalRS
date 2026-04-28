using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Tenancy;
using Xunit;

namespace RhPortal.Api.Tests.Feedback;

/// <summary>Cobertura da Entrega 1.8 (Fase 1 — Paridade Feedz): Catálogo Render Coins.</summary>
public sealed class RenderCoinRewardServiceTests
{
    private const string TenantId = "tenant-coins";

    private static (AppDbContext Db, RenderCoinRewardService Svc) Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var t = new Mock<ITenantContext>();
        t.Setup(x => x.TenantId).Returns(TenantId);
        var db = new AppDbContext(options, t.Object);
        var svc = new RenderCoinRewardService(db, t.Object, NullLogger<RenderCoinRewardService>.Instance);
        return (db, svc);
    }

    private static async Task<Guid> SeedUserComSaldo(AppDbContext db, decimal saldo)
    {
        var uid = Guid.NewGuid();
        db.Users.Add(new ApplicationUser
        {
            Id = uid, TenantId = TenantId, FullName = "Test User",
            Email = $"u-{uid:N}@x.com", UserName = $"u-{uid:N}",
        });
        db.RenderCoinBalances.Add(new RenderCoinBalance
        {
            TenantId = TenantId, UserId = uid, Balance = saldo, UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return uid;
    }

    [Fact]
    public async Task Seeder_Cria6Recompensas()
    {
        var (db, _) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var rs = await db.RenderCoinRewards.IgnoreQueryFilters()
            .Where(r => r.TenantId == TenantId).ToListAsync();

        Assert.Equal(6, rs.Count);
        Assert.All(rs, r => Assert.True(r.IsSystem));
        Assert.All(rs, r => Assert.True(r.CustoCoins > 0));
    }

    [Fact]
    public async Task Seeder_Idempotente()
    {
        var (db, _) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        Assert.Equal(6, await db.RenderCoinRewards.IgnoreQueryFilters().CountAsync(r => r.TenantId == TenantId));
    }

    [Fact]
    public async Task ListAsync_ApenasAtivos_Default()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var first = await db.RenderCoinRewards.IgnoreQueryFilters().FirstAsync();
        first.IsActive = false;
        await db.SaveChangesAsync();

        var ativos = await svc.ListAsync(false, default);
        Assert.Equal(5, ativos.Count);
    }

    [Fact]
    public async Task CreateAsync_CodigoDuplicado_LancaErro()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(
            new RenderCoinRewardCreateRequest(RenderCoinRewardSeeder.CodDayOff, "X", 100), default));
    }

    [Fact]
    public async Task CreateAsync_CustoZero_LancaErro()
    {
        var (_, svc) = Create();
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(
            new RenderCoinRewardCreateRequest("X", "X", 0), default));
    }

    [Fact]
    public async Task RedeemAsync_SemSaldo_LancaErro()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters().FirstAsync();
        var uid = await SeedUserComSaldo(db, 0m);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default));
    }

    [Fact]
    public async Task RedeemAsync_SaldoInsuficiente_LancaErro()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters()
            .FirstAsync(r => r.Codigo == RenderCoinRewardSeeder.CodDayOff);
        var uid = await SeedUserComSaldo(db, 100m); // dayoff custa 800

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default));
    }

    [Fact]
    public async Task RedeemAsync_RewardInativo_LancaErro()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters().FirstAsync();
        reward.IsActive = false;
        await db.SaveChangesAsync();
        var uid = await SeedUserComSaldo(db, 10000m);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default));
    }

    [Fact]
    public async Task RedeemAsync_EstoqueZerado_LancaErro()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters().FirstAsync(r => r.EstoqueDisponivel.HasValue);
        reward.EstoqueDisponivel = 0;
        await db.SaveChangesAsync();
        var uid = await SeedUserComSaldo(db, 10000m);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default));
    }

    [Fact]
    public async Task RedeemAsync_Sucesso_DebitaSaldoEDecrementaEstoque()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters()
            .FirstAsync(r => r.Codigo == RenderCoinRewardSeeder.CodCafeMimo); // 100 coins, ilimitado
        var uid = await SeedUserComSaldo(db, 500m);

        var redemption = await svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default);

        Assert.Equal(0, redemption.Status); // Solicitado
        Assert.Equal(100m, redemption.CoinsGastos);

        var balance = await db.RenderCoinBalances.IgnoreQueryFilters().FirstAsync(b => b.UserId == uid);
        Assert.Equal(400m, balance.Balance);

        var tx = await db.RenderCoinTransactions.IgnoreQueryFilters().Where(t => t.UserId == uid).ToListAsync();
        Assert.Single(tx);
        Assert.Equal(-100m, tx[0].Amount);
    }

    [Fact]
    public async Task RedeemAsync_RewardComEstoque_DecrementaEstoque()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters()
            .FirstAsync(r => r.Codigo == RenderCoinRewardSeeder.CodMassagem); // 250, estoque 5
        var uid = await SeedUserComSaldo(db, 1000m);

        await svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default);

        await db.Entry(reward).ReloadAsync();
        Assert.Equal(4, reward.EstoqueDisponivel);
    }

    [Fact]
    public async Task UpdateRedemptionStatus_Cancelar_EstornaCoinsEDevolveEstoque()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters()
            .FirstAsync(r => r.Codigo == RenderCoinRewardSeeder.CodMassagem);
        var uid = await SeedUserComSaldo(db, 1000m);
        var rh = await SeedUserComSaldo(db, 0m);

        var red = await svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default);

        await db.Entry(reward).ReloadAsync();
        var estoqueAposResgate = reward.EstoqueDisponivel;

        await svc.UpdateRedemptionStatusAsync(red.Id,
            new RenderCoinRedemptionStatusUpdateRequest(NovoStatus: 3, Observacao: "cancelei"), rh, default);

        // Saldo restaurado
        var balance = await db.RenderCoinBalances.IgnoreQueryFilters().FirstAsync(b => b.UserId == uid);
        Assert.Equal(1000m, balance.Balance);

        // Estoque devolvido
        await db.Entry(reward).ReloadAsync();
        Assert.Equal(estoqueAposResgate + 1, reward.EstoqueDisponivel);
    }

    [Fact]
    public async Task UpdateRedemptionStatus_StatusInvalido_LancaErro()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters().FirstAsync();
        var uid = await SeedUserComSaldo(db, 10000m);
        var red = await svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.UpdateRedemptionStatusAsync(
            red.Id, new RenderCoinRedemptionStatusUpdateRequest(NovoStatus: 99), uid, default));
    }

    [Fact]
    public async Task UpdateRedemptionStatus_Aprovar_NaoMexeSaldo()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters()
            .FirstAsync(r => r.Codigo == RenderCoinRewardSeeder.CodCafeMimo);
        var uid = await SeedUserComSaldo(db, 500m);
        var red = await svc.RedeemAsync(uid, new RenderCoinRedeemRequest(reward.Id), default);

        await svc.UpdateRedemptionStatusAsync(red.Id,
            new RenderCoinRedemptionStatusUpdateRequest(NovoStatus: 1), uid, default);

        var balance = await db.RenderCoinBalances.IgnoreQueryFilters().FirstAsync(b => b.UserId == uid);
        Assert.Equal(400m, balance.Balance); // Sem alteração após Aprovar
    }

    [Fact]
    public async Task ListRedemptions_FiltroPorUsuario_Funciona()
    {
        var (db, svc) = Create();
        await RenderCoinRewardSeeder.EnsureAsync(db, TenantId, default);
        var reward = await db.RenderCoinRewards.IgnoreQueryFilters()
            .FirstAsync(r => r.Codigo == RenderCoinRewardSeeder.CodCafeMimo);
        var uid1 = await SeedUserComSaldo(db, 500m);
        var uid2 = await SeedUserComSaldo(db, 500m);

        await svc.RedeemAsync(uid1, new RenderCoinRedeemRequest(reward.Id), default);
        await svc.RedeemAsync(uid2, new RenderCoinRedeemRequest(reward.Id), default);

        var doUid1 = await svc.ListRedemptionsAsync(uid1, null, default);
        Assert.Single(doUid1);

        var todos = await svc.ListRedemptionsAsync(null, null, default);
        Assert.Equal(2, todos.Count);
    }
}
