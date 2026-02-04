namespace LioTecnica.Web.Models;

public class ErrorViewModel
{
    public string? RequestId { get; set; }

    /// <summary>Friendly message when the error is API connection (e.g. Connection refused).</summary>
    public string? FriendlyMessage { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
}
