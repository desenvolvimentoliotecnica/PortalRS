namespace RhPortal.Api.Domain.Entities;

public sealed class Tenant
{
    public string TenantId { get; set; } = default!;
    public string Name { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>Owner que criou o tenant (null para tenants antigos ou seed).</summary>
    public Guid? CreatedByOwnerId { get; set; }
    public Owner? CreatedByOwner { get; set; }
}
