using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Logging.Entities;

public sealed class LogEntry : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public Guid RequestLogId { get; set; }
    public string TransactionId { get; set; } = default!;
    public string EnvironmentName { get; set; } = default!;
    public string EnvironmentNormalized { get; set; } = default!;
    public string DeviceId { get; set; } = default!;
    public string? DeviceType { get; set; }
    public string? Platform { get; set; }
    public string? Browser { get; set; }
    public string? DeviceAppVersion { get; set; }
    public string? Locale { get; set; }
    public int Order { get; set; }
    public string Level { get; set; } = default!;
    public string Category { get; set; } = default!;
    public int? EventId { get; set; }
    public string? EventName { get; set; }
    public string Message { get; set; } = default!;
    public string? ExceptionType { get; set; }
    public string? ExceptionMessage { get; set; }
    public string? ExceptionStackTrace { get; set; }
    public string? PropertiesJson { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
