namespace LioTecnica.Web.ViewModels.Portal;

public sealed class PortalVagasIndexViewModel
{
    public string TenantId { get; init; } = string.Empty;
    public string ApiBaseUrl { get; init; } = string.Empty;
    public bool IsAdmin { get; init; }
    public string UserDisplayName { get; init; } = string.Empty;
    public string UserEmail { get; init; } = string.Empty;
    public string UserInitials { get; init; } = string.Empty;
}
