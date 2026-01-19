using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Auditing.Entities;

public sealed class AuditTransaction : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string TransactionId { get; set; } = default!;
    public string? CorrelationId { get; set; }
    public string? TraceId { get; set; }
    public string? SpanId { get; set; }
    public string? ParentSpanId { get; set; }
    public string Environment { get; set; } = "dev";
    public string AppVersion { get; set; } = "unknown";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public long DurationMs { get; set; }
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public string? ClientId { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    public string? Host { get; set; }
    public string Method { get; set; } = default!;
    public string Path { get; set; } = default!;
    public string? QueryString { get; set; }
    public string? RouteTemplate { get; set; }
    public string? Controller { get; set; }
    public string? Action { get; set; }
    public int? StatusCode { get; set; }
    public bool IsSuccess { get; set; }
    public string? RequestContentType { get; set; }
    public string? ResponseContentType { get; set; }
    public string? RequestBody { get; set; }
    public string? ResponseBody { get; set; }
    public string? RequestBodyHash { get; set; }
    public string? ResponseBodyHash { get; set; }
    public bool RequestIsTruncated { get; set; }
    public bool ResponseIsTruncated { get; set; }
    public int RequestTruncatedBytes { get; set; }
    public int ResponseTruncatedBytes { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorStackTrace { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public List<AuditEvent> Events { get; set; } = [];
}
