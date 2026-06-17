namespace LiotecnicaHub.Web.Domain.Entities;

public class HubPermission
{
    public Guid Id { get; set; }
    public Guid SystemId { get; set; }
    public Guid ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public HubSystem System { get; set; } = null!;
    public HubSystemModule Module { get; set; } = null!;
    public ICollection<HubProfilePermission> ProfilePermissions { get; set; } = new List<HubProfilePermission>();
}
