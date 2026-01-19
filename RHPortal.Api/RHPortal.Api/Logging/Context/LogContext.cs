namespace RhPortal.Api.Logging.Context;

public sealed class LogContext
{
    public Guid RequestLogId { get; set; }
    public string TenantId { get; set; } = "system";
    public string TransactionId { get; set; } = Guid.NewGuid().ToString("N");
    public string? CorrelationId { get; set; }
    public string? TraceId { get; set; }
    public string EnvironmentName { get; set; } = "Development";
    public string EnvironmentNormalized { get; set; } = "dev";
    public string DeviceId { get; set; } = "unknown";
    public string? DeviceType { get; set; }
    public string? Platform { get; set; }
    public string? Browser { get; set; }
    public string? DeviceAppVersion { get; set; }
    public string? Locale { get; set; }

    private int _order;
    private int _errors;
    private int _warnings;

    public int NextOrder() => Interlocked.Increment(ref _order);
    public void IncrementError() => Interlocked.Increment(ref _errors);
    public void IncrementWarning() => Interlocked.Increment(ref _warnings);
    public int ErrorCount => _errors;
    public int WarningCount => _warnings;
}
