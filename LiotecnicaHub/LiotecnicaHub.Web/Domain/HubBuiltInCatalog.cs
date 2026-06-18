namespace LiotecnicaHub.Web.Domain;

/// <summary>
/// Perfis e sistemas criados pelo seed — editáveis, mas não excluíveis pela UI admin.
/// </summary>
public static class HubBuiltInCatalog
{
    public static readonly HashSet<string> ProfileCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "administrador",
        "colaborador",
        "analista-rh",
        "coordenador-rh",
        "gestor",
        "ti"
    };

    public static readonly HashSet<string> SystemCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "hub",
        "portalrh",
        "totvs",
        "intranet",
        "chamados-ti",
        "bi",
        "financeiro",
        "treinamentos",
        "documentos"
    };

    public static bool IsBuiltInProfile(string code) =>
        !string.IsNullOrWhiteSpace(code) && ProfileCodes.Contains(code.Trim());

    public static bool IsBuiltInSystem(string code) =>
        !string.IsNullOrWhiteSpace(code) && SystemCodes.Contains(code.Trim());
}
