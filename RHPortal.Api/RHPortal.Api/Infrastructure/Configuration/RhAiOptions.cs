namespace RhPortal.Api.Infrastructure.Configuration;

/// <summary>
/// Configuração do serviço RHPortal.Ai (matching por filtros).
/// </summary>
public sealed class RhAiOptions
{
    public const string SectionName = "RhAi";

    /// <summary>URL base do RHPortal.Ai (ex.: http://localhost:8000).</summary>
    public string? BaseUrl { get; set; }

    /// <summary>
    /// Versão padrão da regra de matching (ex.: v1_80_20, v2_65_35_strict).
    /// </summary>
    public string DefaultRuleVersion { get; set; } = "v2_65_35_strict";

    /// <summary>
    /// Override por tenant (tenantId -> versão da regra).
    /// </summary>
    public Dictionary<string, string>? TenantRuleVersions { get; set; }

    public string ResolveRuleVersion(string? tenantId)
    {
        var normalizedTenant = tenantId?.Trim() ?? string.Empty;
        if (TenantRuleVersions != null && normalizedTenant.Length > 0)
        {
            foreach (var kv in TenantRuleVersions)
            {
                if (string.Equals(kv.Key?.Trim(), normalizedTenant, StringComparison.OrdinalIgnoreCase)
                    && !string.IsNullOrWhiteSpace(kv.Value))
                {
                    return kv.Value.Trim();
                }
            }
        }
        return string.IsNullOrWhiteSpace(DefaultRuleVersion) ? "v2_65_35_strict" : DefaultRuleVersion.Trim();
    }
}
