using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Auditing.Entities;

public sealed class AuditEntityPropertyChange : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public Guid AuditEntityChangeId { get; set; }
    public string PropertyName { get; set; } = default!;
    public string? BeforeValue { get; set; }
    public string? AfterValue { get; set; }
    public bool IsSensitive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public AuditEntityChange? EntityChange { get; set; }
}
