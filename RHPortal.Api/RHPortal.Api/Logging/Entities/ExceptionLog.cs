using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Logging.Entities;

public sealed class ExceptionLog : ITenantEntity
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
    public DateTimeOffset OccurredAt { get; set; }
    public bool IsHandled { get; set; }
    public int StatusCode { get; set; }
    public string ExceptionType { get; set; } = default!;
    public string Message { get; set; } = default!;
    public string? StackTrace { get; set; }
    public string? InnerExceptionType { get; set; }
    public string? InnerMessage { get; set; }
    public string? ProblemTitle { get; set; }
    public string? ProblemDetail { get; set; }
    public string? ProblemType { get; set; }
    public string? ValidationErrorsJson { get; set; }
    public string? Tags { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
