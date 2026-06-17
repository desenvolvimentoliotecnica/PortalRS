using LiotecnicaHub.Web.Domain.Enums;

namespace LiotecnicaHub.Web.Domain.Entities;

public class HubApplicationAccessRule
{
    public Guid Id { get; set; }
    public Guid HubApplicationId { get; set; }
    public HubAccessRuleType RuleType { get; set; }
    public string? Value { get; set; }

    public HubApplication Application { get; set; } = null!;
}
