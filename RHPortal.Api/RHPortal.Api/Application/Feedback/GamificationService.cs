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

    public async Task<MonthlyTop3HistoryResponse> GetMonthlyTop3HistoryAsync(
        int months = 6,
        decimal goal = 5000,
        CancellationToken ct = default)
    {
        _ = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");

        months = Math.Clamp(months, 1, 36);
        var start = DateTimeOffset.UtcNow.AddMonths(-months);

        var aggregates = await _db.RenderCoinTransactions
            .AsNoTracking()
            .Where(x => x.CreatedAtUtc >= start)
            .GroupBy(x => new { x.UserId, Year = x.CreatedAtUtc.Year, Month = x.CreatedAtUtc.Month })
            .Select(g => new
            {
                g.Key.UserId,
                g.Key.Year,
                g.Key.Month,
                Points = g.Sum(x => x.Amount)
            })
            .ToListAsync(ct);

        var userIds = aggregates.Select(x => x.UserId).Distinct().ToList();
        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToListAsync(ct);

        var nameById = users.ToDictionary(x => x.Id, x => x.FullName ?? "", EqualityComparer<Guid>.Default);

        var monthGroups = aggregates
            .GroupBy(x => new { x.Year, x.Month })
            .OrderByDescending(g => g.Key.Year)
            .ThenByDescending(g => g.Key.Month)
            .Take(months)
            .ToList();

        var items = monthGroups.Select(g =>
        {
            var top = g
                .OrderByDescending(x => x.Points)
                .ThenBy(x => x.UserId)
                .Take(3)
                .Select((x, idx) => new MonthlyTop3Entry(
                    x.UserId,
                    nameById.TryGetValue(x.UserId, out var n) ? n : x.UserId.ToString(),
                    x.Points,
                    idx + 1))
                .ToList();

            return new MonthlyTop3Snapshot(g.Key.Year, g.Key.Month, goal, top);
        }).ToList();

        return new MonthlyTop3HistoryResponse(items);
    }
}
