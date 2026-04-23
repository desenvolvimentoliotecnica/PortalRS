namespace RhPortal.Api.Contracts.Logging;

public sealed record RequestLogListItem(
    Guid Id,
    string TransactionId,
    DateTimeOffset StartedAt,
    long DurationMs,
    string Method,
    string Path,
    int? StatusCode,
    bool IsSuccess,
    string? UserName,
    string EnvironmentNormalized,
    string DeviceType
);

public sealed record RequestLogListResponse(
    IReadOnlyList<RequestLogListItem> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages
);

public sealed record LogEntryItem(
    Guid Id,
    int Order,
    string Level,
    string Category,
    int? EventId,
    string? EventName,
    string Message,
    DateTimeOffset OccurredAt
);

/// <summary>Item da listagem de logs operacionais (flat view cross-request).</summary>
public sealed record OperationalLogItem(
    Guid Id,
    string? Level,
    string? Message,
    string? Source,
    DateTimeOffset Timestamp,
    string? Exception
);

public sealed record OperationalLogListResponse(
    IReadOnlyList<OperationalLogItem> Items,
    int TotalCount
);

public sealed record ExceptionLogItem(
    Guid Id,
    int Order,
    bool IsHandled,
    int StatusCode,
    string ExceptionType,
    string Message,
    string? Tags,
    DateTimeOffset OccurredAt
);

public sealed record RequestLogDetailResponse(
    Guid Id,
    string TransactionId,
    string? CorrelationId,
    string? TraceId,
    string EnvironmentName,
    string EnvironmentNormalized,
    string DeviceId,
    string? DeviceType,
    string? Platform,
    string? Browser,
    string? DeviceAppVersion,
    string? Locale,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    long DurationMs,
    string Method,
    string Path,
    string? QueryString,
    int? StatusCode,
    bool IsSuccess,
    string? UserId,
    string? UserName,
    string? ClientId,
    string? Ip,
    string? UserAgent,
    string? Host,
    string? Controller,
    string? Action,
    string? RouteTemplate,
    int ErrorCount,
    int WarningCount,
    IReadOnlyList<LogEntryItem> Entries,
    IReadOnlyList<ExceptionLogItem> Exceptions
);

public sealed record RequestLogSummaryItem(string Key, int Count, long AvgMs);
public sealed record RequestLogStatusItem(int StatusCode, int Count);

public sealed record RequestLogSummaryResponse(
    IReadOnlyList<RequestLogSummaryItem> TopRoutes,
    IReadOnlyList<RequestLogSummaryItem> TopUsers,
    IReadOnlyList<RequestLogStatusItem> Statuses
);
