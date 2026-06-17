namespace LiotecnicaHub.Web.Domain.Entities;

public class HubSystem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Url { get; set; }
    public string? IconKey { get; set; }
    public bool IsActive { get; set; } = true;
    public bool RequiresApproval { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public ICollection<HubSystemModule> Modules { get; set; } = new List<HubSystemModule>();
    public ICollection<HubPermission> Permissions { get; set; } = new List<HubPermission>();
    public ICollection<HubApplication> Applications { get; set; } = new List<HubApplication>();
}
