namespace LiotecnicaHub.Web.Domain.Entities;

public class HubUser
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string? PasswordHash { get; set; }
    /// <summary>Quando true, login por e-mail usa LDAP/AD e o seed não recria senha local de admin.</summary>
    public bool PreferDirectoryAuth { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public ICollection<HubUserProfile> UserProfiles { get; set; } = new List<HubUserProfile>();
    public ICollection<HubUserProfileScope> UserProfileScopes { get; set; } = new List<HubUserProfileScope>();
    public ICollection<HubUserApplicationAccess> UserApplicationAccesses { get; set; } = new List<HubUserApplicationAccess>();
}
