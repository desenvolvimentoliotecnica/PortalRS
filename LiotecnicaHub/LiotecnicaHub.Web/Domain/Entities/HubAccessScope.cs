using LiotecnicaHub.Web.Domain.Enums;

namespace LiotecnicaHub.Web.Domain.Entities;

public class HubAccessScope
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public HubAccessScopeType ScopeType { get; set; }
    public string? ExternalCode { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public ICollection<HubUserProfileScope> UserProfileScopes { get; set; } = new List<HubUserProfileScope>();
}
