using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Logging.Entities;

public sealed class RequestLog : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string TransactionId { get; set; } = default!;
    public string? CorrelationId { get; set; }
    public string? TraceId { get; set; }
    public string EnvironmentName { get; set; } = default!;
    public string EnvironmentNormalized { get; set; } = default!;
    public string DeviceId { get; set; } = default!;
    public string? DeviceType { get; set; }
    public string? Platform { get; set; }
    public string? Browser { get; set; }
    public string? DeviceAppVersion { get; set; }
    public string? Locale { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public long DurationMs { get; set; }
    public string Method { get; set; } = default!;
    public string Path { get; set; } = default!;
    public string? QueryString { get; set; }
    public int? StatusCode { get; set; }
    public bool IsSuccess { get; set; }
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public string? ClientId { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    public string? Host { get; set; }
    public string? Controller { get; set; }
    public string? Action { get; set; }
    public string? RouteTemplate { get; set; }
    public string? RequestBodySnippet { get; set; }
    public string? ResponseBodySnippet { get; set; }
    public int ErrorCount { get; set; }
    public int WarningCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
