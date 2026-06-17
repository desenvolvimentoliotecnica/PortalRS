namespace LiotecnicaHub.Web.Domain.Entities;

public class HubUserProfileScope
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ProfileId { get; set; }
    public Guid ScopeId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }

    public HubUser User { get; set; } = null!;
    public HubProfile Profile { get; set; } = null!;
    public HubAccessScope Scope { get; set; } = null!;
}
