using LiotecnicaHub.Web.Domain.Enums;

namespace LiotecnicaHub.Web;

public static class HubUiHelpers
{
    public static string EnvironmentLabel(HubApplicationEnvironment env) => env switch
    {
        HubApplicationEnvironment.Dev => "DEV",
        HubApplicationEnvironment.Hml => "HML",
        HubApplicationEnvironment.Prd => "PRD",
        _ => env.ToString().ToUpperInvariant()
    };

    public static string EnvironmentCssClass(HubApplicationEnvironment env) => env switch
    {
        HubApplicationEnvironment.Dev => "env-dev",
        HubApplicationEnvironment.Hml => "env-hml",
        HubApplicationEnvironment.Prd => "env-prd",
        _ => "env-default"
    };

    public static string GetInitials(string? displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
            return "?";

        var parts = displayName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2)
            return $"{char.ToUpperInvariant(parts[0][0])}{char.ToUpperInvariant(parts[^1][0])}";

        return char.ToUpperInvariant(displayName.Trim()[0]).ToString();
    }

    public static string DisplayAppTitle(string name)
    {
        var idx = name.LastIndexOf(" — ", StringComparison.Ordinal);
        return idx > 0 ? name[..idx].Trim() : name.Trim();
    }

    public static string ResolveAppIconKey(string? appName)
    {
        var name = appName?.ToLowerInvariant() ?? string.Empty;
        if (name.Contains("portal rh") || name.Contains("portalrh"))
            return "portal-rh";
        if (name.Contains("totvs"))
            return "totvs";
        if (name.Contains("intranet"))
            return "intranet";
        if (name.Contains("chamado") || name.Contains(" ti"))
            return "ti";
        if (name.Contains("document"))
            return "docs";
        if (name.Contains("bi") || name.Contains("relat"))
            return "bi";
        if (name.Contains("finance"))
            return "finance";
        if (name.Contains("trein") || name.Contains("ead"))
            return "training";
        return "default";
    }
}
