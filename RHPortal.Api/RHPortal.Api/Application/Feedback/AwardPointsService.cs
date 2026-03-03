using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

public sealed class AwardPointsResult
{
    public bool Awarded { get; init; }
    public decimal Amount { get; init; }
    public string EventType { get; init; } = string.Empty;
    public string? SourceId { get; init; }
    public string Reason { get; init; } = string.Empty;
}

public sealed class AwardPointsService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private static readonly string[] TimezoneCandidates =
    [
        "America/Sao_Paulo",
        "E. South America Standard Time",
    ];

    public AwardPointsService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<AwardPointsResult> AwardAsync(
        Guid userId,
        string eventType,
        string? sourceId = null,
        string? reason = null,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context required.");
        if (!GamificationRuleCatalog.TryGet(eventType, out var rule))
            return new AwardPointsResult { EventType = eventType, Awarded = false, Amount = 0m, SourceId = sourceId, Reason = reason ?? eventType };

        var businessDate = GetBusinessDate();
        var safeSourceId = string.IsNullOrWhiteSpace(sourceId)
            ? BuildDefaultSourceId(eventType, businessDate)
            : sourceId.Trim();
        var reasonText = string.IsNullOrWhiteSpace(reason) ? rule.Label : reason.Trim();

        if (rule.IdempotentBySource)
        {
            var alreadyAwarded = await _db.RenderCoinTransactions
                .AsNoTracking()
                .AnyAsync(x =>
                    x.TenantId == tenantId &&
                    x.UserId == userId &&
                    x.SourceType == eventType &&
                    x.SourceId == safeSourceId,
                    ct);
            if (alreadyAwarded)
            {
                return new AwardPointsResult { EventType = eventType, Awarded = false, Amount = 0m, SourceId = safeSourceId, Reason = reasonText };
            }
        }

        var dailyCount = await _db.RenderCoinTransactions
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.SourceType == eventType)
            .CountAsync(x => x.CreatedAtUtc >= businessDate.StartUtc && x.CreatedAtUtc < businessDate.EndUtc, ct);
        if (rule.DailyCap.HasValue && dailyCount >= rule.DailyCap.Value)
        {
            return new AwardPointsResult { EventType = eventType, Awarded = false, Amount = 0m, SourceId = safeSourceId, Reason = reasonText };
        }

        var tx = new RenderCoinTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Amount = rule.Points,
            Reason = reasonText,
            SourceType = eventType,
            SourceId = safeSourceId,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.RenderCoinTransactions.Add(tx);

        var balance = await _db.RenderCoinBalances.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (balance is null)
        {
            balance = new RenderCoinBalance
            {
                TenantId = tenantId,
                UserId = userId,
                Balance = rule.Points,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _db.RenderCoinBalances.Add(balance);
        }
        else
        {
            balance.Balance += rule.Points;
            balance.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await UpdateDailyStateAsync(tenantId, userId, eventType, businessDate.Date, ct);
        await _db.SaveChangesAsync(ct);

        return new AwardPointsResult
        {
            EventType = eventType,
            Awarded = true,
            Amount = rule.Points,
            SourceId = safeSourceId,
            Reason = reasonText
        };
    }

    private async Task UpdateDailyStateAsync(string tenantId, Guid userId, string eventType, DateOnly businessDate, CancellationToken ct)
    {
        var state = await _db.GamificationDailyStates.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (state is null)
        {
            state = new GamificationDailyState
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _db.GamificationDailyStates.Add(state);
        }

        if (state.LastActivityDate != businessDate)
        {
            state.FeedbackSentToday = 0;
            state.CelebrationPostsToday = 0;
            state.CelebrationCommentsToday = 0;
            state.OneOnOneCompletedToday = 0;
            state.DevelopmentPlansCreatedToday = 0;
            state.SurveyAnsweredToday = 0;
        }

        state.LastActivityDate = businessDate;
        state.UpdatedAtUtc = DateTimeOffset.UtcNow;

        switch (eventType)
        {
            case GamificationEventTypes.DailyLogin:
                if (state.LastCheckInDate is null)
                {
                    state.CurrentStreak = 1;
                    state.BestStreak = Math.Max(state.BestStreak, state.CurrentStreak);
                }
                else
                {
                    var last = state.LastCheckInDate.Value;
                    if (last == businessDate)
                    {
                        // idempotent path: no-op
                    }
                    else if (last.AddDays(1) == businessDate)
                    {
                        state.CurrentStreak += 1;
                        state.BestStreak = Math.Max(state.BestStreak, state.CurrentStreak);
                    }
                    else
                    {
                        state.CurrentStreak = 1;
                        state.BestStreak = Math.Max(state.BestStreak, state.CurrentStreak);
                    }
                }
                state.LastCheckInDate = businessDate;
                break;
            case GamificationEventTypes.FeedbackSent:
                state.FeedbackSentToday += 1;
                break;
            case GamificationEventTypes.CelebrationPost:
                state.CelebrationPostsToday += 1;
                break;
            case GamificationEventTypes.CelebrationComment:
                state.CelebrationCommentsToday += 1;
                break;
            case GamificationEventTypes.OneOnOneCompleted:
                state.OneOnOneCompletedToday += 1;
                break;
            case GamificationEventTypes.DevelopmentPlanCreated:
                state.DevelopmentPlansCreatedToday += 1;
                break;
            case GamificationEventTypes.SurveyAnswered:
                state.SurveyAnsweredToday += 1;
                break;
        }
    }

    private static string BuildDefaultSourceId(string eventType, (DateOnly Date, DateTimeOffset StartUtc, DateTimeOffset EndUtc) businessDate)
        => $"{eventType}:{businessDate.Date:yyyy-MM-dd}";

    private static (DateOnly Date, DateTimeOffset StartUtc, DateTimeOffset EndUtc) GetBusinessDate()
    {
        var tz = ResolveBusinessTimezone();

        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        var date = DateOnly.FromDateTime(localNow.DateTime);
        var startLocal = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var endLocal = startLocal.AddDays(1);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, tz);
        return (date, new DateTimeOffset(startUtc), new DateTimeOffset(endUtc));
    }

    private static TimeZoneInfo ResolveBusinessTimezone()
    {
        foreach (var timezoneId in TimezoneCandidates)
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(timezoneId); }
            catch { /* try next */ }
        }
        return TimeZoneInfo.Utc;
    }
}
