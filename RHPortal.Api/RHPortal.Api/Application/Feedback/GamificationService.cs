using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
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
            userId,
            balance?.Balance ?? 0,
            balance?.UpdatedAtUtc ?? DateTimeOffset.MinValue);
    }

    public async Task<GamificationProfileResponse> GetMyProfileAsync(Guid userId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var all = await _db.RenderCoinBalances
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.Balance)
            .ThenBy(x => x.UpdatedAtUtc)
            .Select(x => new { x.UserId, x.Balance })
            .ToListAsync(ct);

        var me = all.FirstOrDefault(x => x.UserId == userId);
        var rank = 0;
        if (me is not null)
            rank = all.FindIndex(x => x.UserId == userId) + 1;

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, ct);
        var daily = await _db.GamificationDailyStates.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == userId, ct);
        var balance = me?.Balance ?? 0m;
        var (level, progress) = GetLevelInfo(balance);

        return new GamificationProfileResponse(
            userId,
            user?.FullName ?? user?.UserName ?? "Colaborador",
            balance,
            rank == 0 ? Math.Max(all.Count, 1) : rank,
            level,
            progress,
            daily?.CurrentStreak ?? 0,
            daily?.BestStreak ?? 0,
            daily?.LastCheckInDate);
    }

    public async Task<IReadOnlyList<DailyActivityResponse>> GetDailyActivitiesAsync(Guid userId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        var state = await _db.GamificationDailyStates.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == userId, ct);

        static DailyActivityResponse Make(string key, string label, int current, int target)
            => new(key, label, current, target, current >= target);

        return
        [
            Make("daily_login", "check-in diário", state?.LastCheckInDate == GetBusinessDate() ? 1 : 0, 1),
            Make("feedbacks", "feedbacks enviados", state?.FeedbackSentToday ?? 0, 2),
            Make("celebrations", "celebrações publicadas", state?.CelebrationPostsToday ?? 0, 1),
            Make("comments", "comentários em celebrações", state?.CelebrationCommentsToday ?? 0, 2),
            Make("oneonone", "1:1 concluídas", state?.OneOnOneCompletedToday ?? 0, 1),
        ];
    }

    public IReadOnlyCollection<GamificationRuleResponse> GetRules()
        => GamificationRuleCatalog.GetAll()
            .Select(x => new GamificationRuleResponse(x.EventType, x.Label, x.Points, x.DailyCap))
            .ToArray();

    public async Task<MonthlyTop3HistoryResponse> GetMonthlyTop3HistoryAsync(
        int months = 6,
        decimal goal = 5000,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");

        months = Math.Clamp(months, 1, 36);
        var start = DateTimeOffset.UtcNow.AddMonths(-months);

        var aggregates = await _db.RenderCoinTransactions
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CreatedAtUtc >= start)
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

            return new MonthlyTop3Snapshot(g.Key.Year, g.Key.Month, goal, $"{g.Key.Month:00}/{g.Key.Year}", top);
        }).ToList();

        return new MonthlyTop3HistoryResponse(items);
    }

    private static (string Level, int Progress) GetLevelInfo(decimal balance)
    {
        if (balance < 500) return ("Iniciante", (int)Math.Clamp((balance / 500m) * 100m, 0m, 100m));
        if (balance < 1500) return ("Engajado", (int)Math.Clamp(((balance - 500m) / 1000m) * 100m, 0m, 100m));
        if (balance < 3000) return ("Influente", (int)Math.Clamp(((balance - 1500m) / 1500m) * 100m, 0m, 100m));
        return ("Embaixador", 100);
    }

    private static DateOnly GetBusinessDate()
    {
        var timezoneCandidates = new[] { "America/Sao_Paulo", "E. South America Standard Time" };
        foreach (var timezoneId in timezoneCandidates)
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
                var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
                return DateOnly.FromDateTime(localNow.DateTime);
            }
            catch { /* try next */ }
        }
        return DateOnly.FromDateTime(DateTimeOffset.UtcNow.DateTime);
    }
}
