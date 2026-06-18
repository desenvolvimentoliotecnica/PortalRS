namespace LiotecnicaHub.Web.Domain.Entities;

public class HubProfilePermission
{
    public Guid ProfileId { get; set; }
    public Guid PermissionId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }

    public HubProfile Profile { get; set; } = null!;
    public HubPermission Permission { get; set; } = null!;
}
