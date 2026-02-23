namespace Liotecnica.Integration.RM;

/// <summary>
/// Opções para chamar a API do Portal RH.
/// Inclui base URL, tenant e chave de API (configurável; criar a chave manualmente no portal).
/// </summary>
public sealed class PortalApiOptions
{
    public const string SectionName = "Portal";

    /// <summary>URL base da API (ex.: https://api.portal.exemplo/).</summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Tenant ID (header X-Tenant-Id).</summary>
    public string TenantId { get; set; } = string.Empty;

    /// <summary>Chave de API para autenticação (criar manualmente no portal; não commitar em repositório).</summary>
    public string ApiKey { get; set; } = string.Empty;
}
