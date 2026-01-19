namespace RhPortal.Api.Contracts.Auditing;

public sealed record AuditTransactionListItem(
    Guid Id,
    string TransactionId,
    string? CorrelationId,
    DateTimeOffset StartedAt,
    long DurationMs,
    string? UserName,
    string Method,
    string Path,
    int? StatusCode,
    bool IsSuccess
);

public sealed record AuditTransactionListResponse(
    IReadOnlyList<AuditTransactionListItem> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages
);

public sealed record AuditEventItem(
    Guid Id,
    int Order,
    string EventType,
    string Name,
    DateTimeOffset OccurredAt,
    string? DataJson
);

public sealed record AuditEntityChangeItem(
    Guid Id,
    int Order,
    string EntityName,
    string? TableName,
    string State,
    string PrimaryKeyJson,
    string? BeforeJson,
    string? AfterJson,
    string? ChangedColumns,
    string? DataJson,
    DateTimeOffset OccurredAt
);

public sealed record AuditPropertyChangeItem(
    Guid Id,
    string PropertyName,
    string? BeforeValue,
    string? AfterValue,
    bool IsSensitive
);

public sealed record AuditTransactionDetailResponse(
    Guid Id,
    string TransactionId,
    string? CorrelationId,
    string? TraceId,
    string? SpanId,
    string? ParentSpanId,
    string Environment,
    string AppVersion,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    long DurationMs,
    string? UserId,
    string? UserName,
    string? ClientId,
    string? Ip,
    string? UserAgent,
    string? Host,
    string Method,
    string Path,
    string? QueryString,
    string? RouteTemplate,
    string? Controller,
    string? Action,
    int? StatusCode,
    bool IsSuccess,
    string? RequestContentType,
    string? ResponseContentType,
    string? RequestBody,
    string? ResponseBody,
    string? RequestBodyHash,
    string? ResponseBodyHash,
    bool RequestIsTruncated,
    bool ResponseIsTruncated,
    int RequestTruncatedBytes,
    int ResponseTruncatedBytes,
    string? ErrorMessage,
    string? ErrorStackTrace,
    IReadOnlyList<AuditEventItem> Events,
    IReadOnlyList<AuditEntityChangeItem> Changes,
    IReadOnlyList<AuditPropertyChangeItem> Properties
);

public sealed record AuditSummaryItem(string Key, int Count, long AvgMs);
public sealed record AuditStatusItem(int StatusCode, int Count);

public sealed record AuditSummaryResponse(
    IReadOnlyList<AuditSummaryItem> TopRoutes,
    IReadOnlyList<AuditSummaryItem> TopUsers,
    IReadOnlyList<AuditStatusItem> Statuses
);
