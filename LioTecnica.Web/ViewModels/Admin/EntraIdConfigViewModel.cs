namespace LioTecnica.Web.ViewModels.Admin;

public sealed class EntraIdConfigViewModel
{
    public bool IsEnabled { get; set; }
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public bool HasClientSecret { get; set; }
    public string? CallbackPath { get; set; }
}

public sealed class EntraIdConfigRequest
{
    public bool IsEnabled { get; set; }
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? CallbackPath { get; set; }
}
