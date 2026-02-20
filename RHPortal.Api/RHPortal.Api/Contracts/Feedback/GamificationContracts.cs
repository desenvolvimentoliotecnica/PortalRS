namespace RhPortal.Api.Contracts.Feedback;

public sealed record LeaderboardEntry(
    Guid UserId,
    string FullName,
    decimal Balance,
    int Rank);

public sealed record LeaderboardResponse(
    IReadOnlyList<LeaderboardEntry> Items,
    int TotalCount,
    int Page,
    int PageSize);

public sealed record MyBalanceResponse(
    decimal Balance,
    DateTimeOffset UpdatedAtUtc);

public sealed record MonthlyTop3Entry(
    Guid UserId,
    string FullName,
    decimal Points,
    int Rank);

public sealed record MonthlyTop3Snapshot(
    int Year,
    int Month,
    decimal Goal,
    IReadOnlyList<MonthlyTop3Entry> Top3);

public sealed record MonthlyTop3HistoryResponse(
    IReadOnlyList<MonthlyTop3Snapshot> Items);
