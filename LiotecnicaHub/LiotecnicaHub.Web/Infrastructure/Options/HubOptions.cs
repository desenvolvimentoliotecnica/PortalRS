namespace LiotecnicaHub.Web.Infrastructure.Options;

public sealed class HubOptions
{
    public const string SectionName = "Hub";

    public string StateSigningKey { get; set; } = string.Empty;

    /// <summary>Permite login por e-mail sem Microsoft (somente Development).</summary>
    public bool AllowDevLogin { get; set; }
}
