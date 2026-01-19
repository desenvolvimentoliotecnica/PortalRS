using System.Collections.Concurrent;

namespace RhPortal.Api.Auditing.Context;

public sealed class AuditContext
{
    public string TenantId { get; init; } = "system";
    public string TransactionId { get; init; } = Guid.NewGuid().ToString("N");
    public string? CorrelationId { get; init; }
    public string? TraceId { get; init; }
    public string? SpanId { get; init; }
    public string? ParentSpanId { get; init; }
    public string? UserId { get; init; }
    public string? UserName { get; init; }
    public string? ClientId { get; init; }
    public string Environment { get; init; } = "dev";
    public string AppVersion { get; init; } = "unknown";
    public DateTimeOffset StartedAt { get; init; } = DateTimeOffset.UtcNow;
    public Guid? AuditTransactionId { get; set; }

    private int _order;

    public int NextOrder()
        => Interlocked.Increment(ref _order);
}
