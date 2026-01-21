namespace RhPortal.Api.Domain.Entities;

public sealed class Menu : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string DisplayName { get; set; } = default!;
    public string Route { get; set; } = default!;
    public string Icon { get; set; } = string.Empty;
    public int Order { get; set; }
    public Guid? ParentId { get; set; }
    public string PermissionKey { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public bool OpenInNewTab { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
