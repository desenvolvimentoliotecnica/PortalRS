using LiotecnicaHub.Web.Domain.Enums;

namespace LiotecnicaHub.Web.Domain.Entities;

public class HubApplication
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
    public string LaunchUrl { get; set; } = string.Empty;
    public HubApplicationEnvironment Environment { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? SystemId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public HubSystem? System { get; set; }
    public ICollection<HubApplicationAccessRule> AccessRules { get; set; } = new List<HubApplicationAccessRule>();
}
