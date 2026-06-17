namespace LiotecnicaHub.Web.Domain.Entities;

public class HubProfile
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public ICollection<HubUserProfile> UserProfiles { get; set; } = new List<HubUserProfile>();
    public ICollection<HubProfilePermission> ProfilePermissions { get; set; } = new List<HubProfilePermission>();
    public ICollection<HubUserProfileScope> UserProfileScopes { get; set; } = new List<HubUserProfileScope>();
}
