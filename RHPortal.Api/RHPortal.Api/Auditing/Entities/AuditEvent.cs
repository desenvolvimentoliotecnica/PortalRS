using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Auditing.Entities;

public sealed class AuditEvent : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public Guid AuditTransactionId { get; set; }
    public int Order { get; set; }
    public string EventType { get; set; } = default!;
    public string Name { get; set; } = default!;
    public DateTimeOffset OccurredAt { get; set; }
    public string? DataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public AuditTransaction? Transaction { get; set; }
    public List<AuditEntityChange> EntityChanges { get; set; } = [];
}
