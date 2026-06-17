namespace LiotecnicaHub.Web.Infrastructure.Options;

public sealed class HubOptions
{
    public const string SectionName = "Hub";

    public string StateSigningKey { get; set; } = string.Empty;

    /// <summary>Chave HMAC para tokens SSO Hub → apps filhos. Se vazio, usa <see cref="StateSigningKey"/>.</summary>
    public string SsoSigningKey { get; set; } = string.Empty;

    /// <summary>Permite login por e-mail sem Microsoft (somente Development).</summary>
    public bool AllowDevLogin { get; set; }
}
