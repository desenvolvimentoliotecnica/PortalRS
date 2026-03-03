namespace RhPortal.Api.Contracts.Feedback;

public sealed record LeaderboardEntry(
    Guid UserId,
    string FullName,
    decimal Balance,
    int Rank);

public sealed record LeaderboardResponse(
    IReadOnlyList<LeaderboardEntry> Items,
    int TotalItems,
    int Page,
    int PageSize);

public sealed record MyBalanceResponse(
    Guid UserId,
    decimal Balance,
    DateTimeOffset UpdatedAtUtc);

public sealed record GamificationRuleResponse(
    string EventType,
    string Label,
    decimal Points,
    int? DailyCap);

public sealed record GamificationProfileResponse(
    Guid UserId,
    string FullName,
    decimal Balance,
    int Rank,
    string Level,
    int LevelProgress,
    int CurrentStreak,
    int BestStreak,
    DateOnly? LastCheckInDate);

public sealed record DailyActivityResponse(
    string Key,
    string Label,
    int Current,
    int Target,
    bool Completed);

public sealed record MonthlyTop3Entry(
    Guid UserId,
    string FullName,
    decimal Points,
    int Rank);

public sealed record MonthlyTop3Snapshot(
    int Year,
    int Month,
    decimal Goal,
    string MonthLabel,
    IReadOnlyList<MonthlyTop3Entry> Top3);

public sealed record MonthlyTop3HistoryResponse(
    IReadOnlyList<MonthlyTop3Snapshot> Items);
