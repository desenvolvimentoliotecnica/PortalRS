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
