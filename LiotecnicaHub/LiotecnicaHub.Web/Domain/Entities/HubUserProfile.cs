namespace LiotecnicaHub.Web.Domain.Entities;

public class HubUserProfile
{
    public Guid UserId { get; set; }
    public Guid ProfileId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }

    public HubUser User { get; set; } = null!;
    public HubProfile Profile { get; set; } = null!;
}
