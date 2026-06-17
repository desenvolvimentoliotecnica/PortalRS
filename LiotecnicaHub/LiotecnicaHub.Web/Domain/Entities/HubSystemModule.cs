namespace LiotecnicaHub.Web.Domain.Entities;

public class HubSystemModule
{
    public Guid Id { get; set; }
    public Guid SystemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public HubSystem System { get; set; } = null!;
    public ICollection<HubPermission> Permissions { get; set; } = new List<HubPermission>();
}
