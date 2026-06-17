namespace LiotecnicaHub.Web.Domain.Entities;

public class HubEntraConfig
{
    public Guid Id { get; set; }
    public bool IsEnabled { get; set; }
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecretProtected { get; set; }
    public string? CallbackPath { get; set; }
    public string? HubBaseUrl { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
