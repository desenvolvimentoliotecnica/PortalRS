namespace RhPortal.Api.Domain.Entities;

public sealed class RoleMenu : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid RoleId { get; set; }
    public ApplicationRole? Role { get; set; }

    public Guid MenuId { get; set; }
    public Menu? Menu { get; set; }

    public string PermissionKey { get; set; } = default!;

    public DateTimeOffset CreatedAtUtc { get; set; }
}
