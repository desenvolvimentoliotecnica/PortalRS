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
}
