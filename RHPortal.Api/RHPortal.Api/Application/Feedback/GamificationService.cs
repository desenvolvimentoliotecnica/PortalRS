using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

public sealed class GamificationService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public GamificationService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<LeaderboardResponse> GetLeaderboardAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.RenderCoinBalances
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Include(x => x.User)
            .OrderByDescending(x => x.Balance)
            .ThenBy(x => x.UpdatedAtUtc);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var rankOffset = (page - 1) * pageSize;
        var entries = items.Select((b, i) => new LeaderboardEntry(
            b.UserId,
            b.User?.FullName ?? b.User?.UserName ?? b.UserId.ToString(),
            b.Balance,
            rankOffset + i + 1)).ToList();

        return new LeaderboardResponse(entries, total, page, pageSize);
    }

    public async Task<MyBalanceResponse> GetMyBalanceAsync(Guid userId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var balance = await _db.RenderCoinBalances
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == userId, ct);
        return new MyBalanceResponse(
            balance?.Balance ?? 0,
            balance?.UpdatedAtUtc ?? DateTimeOffset.MinValue);
    }
}
