using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Auditing.Entities;

public sealed class AuditEntityChange : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public Guid AuditTransactionId { get; set; }
    public Guid? AuditEventId { get; set; }
    public int Order { get; set; }
    public string EntityName { get; set; } = default!;
    public string? TableName { get; set; }
    public string State { get; set; } = default!;
    public string PrimaryKeyJson { get; set; } = default!;
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
    public string? ChangedColumns { get; set; }
    public string? DataJson { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public AuditTransaction? Transaction { get; set; }
    public AuditEvent? Event { get; set; }
    public List<AuditEntityPropertyChange> PropertyChanges { get; set; } = [];
}
