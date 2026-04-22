using RhPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Security;

/// <summary>
/// Source-of-truth for role → permission mapping.
/// Replaces DB-driven RoleMenus so that permissions are code-first,
/// replicate identically across all tenants and environments without
/// requiring manual seeding or migration per tenant.
/// </summary>
public static class RolePermissionManifest
{
    /// <summary>All permissions available to full-access tenant users (Admin, RH, Operacional).</summary>
    private static readonly IReadOnlyList<string> TenantPermissions =
    [
        "dashboard.view",
        "agenda.view",
        "vagas.view",
        "solicitacoes-vaga.view",
        "aprovacoes-vaga.view",
        "projetos.view",
        "processo-seletivo.view",
        "admissao.view",
        "candidatos.view",
        "triagem.view",
        "matching.view",
        "portalvagas.view",
        "entrada.view",
        "relatorios.view",
        "feedback.celebracao.view",
        "feedback.desenvolvimento",
        "feedback.send",
        "feedback.view",
        "feedback.list",
        "feedback.oneonone.view",
        "feedback.gamificacao.view",
        "feedback.gestao.view",
        "gestao.dashboard",
        "gestao.planos",
        "gestao.humor",
        "gestao.resumo",
        "departments.view",
        "areas.view",
        "categories.view",
        "jobpositions.view",
        "units.view",
        "funcionarios.view",
        "bloqueio-pessoa.view",
        "users.read",
        "users.write",
        "roles.manage",
        "menus.manage",
        "access.manage",
        "api-keys.manage",
        "audit.view",
        "logs.view",
        "email-templates.manage",
        "emails.manage",
        "email-config.manage",
        "entra-config.manage",
        "localization-config.manage",
    ];

    /// <summary>Permissions for Colaborador role.</summary>
    private static readonly IReadOnlyList<string> ColaboradorPermissions =
    [
        "dashboard.view",
        "colaborador.perfil",
        "colaborador.dependentes",
        "colaborador.ferias",
        "colaborador.beneficios",
        "colaborador.endereco",
        "colaborador.documentos",
        "colaborador.senha",
        "feedback.send",
        "feedback.view",
        "feedback.gamificacao.view",
    ];

    /// <summary>Restricted permissions for Gestor and Compliance roles.</summary>
    private static readonly IReadOnlyList<string> GestorCompliancePermissions =
    [
        "dashboard.view",
        "aprovacoes-vaga.view",
        "solicitacoes-vaga.view",
        "gestao.dashboard",
    ];

    /// <summary>
    /// Returns the permission list for the given set of role entities.
    /// Most-permissive role wins. Evaluates based on role Tipo and Owner name.
    /// </summary>
    public static IReadOnlyList<string> GetPermissions(IEnumerable<ApplicationRole> roles)
    {
        var roleList = roles.ToList();

        // Owner always gets a wildcard — the frontend resolves which screens to show
        if (roleList.Any(r => string.Equals(r.Name, "Owner", StringComparison.OrdinalIgnoreCase)))
            return ["*"];

        // Full-access tenant roles: Admin, RH, Recrutador, Operacional
        if (roleList.Any(r => r.Tipo == RoleTipo.Admin || r.Tipo == RoleTipo.RhRecrutamentoSelecao || r.Tipo == RoleTipo.RhAdmissao ||
                              string.Equals(r.Name, "Admin", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(r.Name, "Administrador", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(r.Name, "RH", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(r.Name, "Recrutador", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(r.Name, "Operacional", StringComparison.OrdinalIgnoreCase)))
            return TenantPermissions;

        // Gestor / Compliance
        if (roleList.Any(r => r.Tipo == RoleTipo.Gestor || r.Tipo == RoleTipo.Compliance ||
                              string.Equals(r.Name, "Gestor", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(r.Name, "Compliance", StringComparison.OrdinalIgnoreCase)))
            return GestorPermissions;

        // Colaborador
        if (roleList.Any(r => r.Tipo == RoleTipo.Colaborador ||
                              string.Equals(r.Name, "Colaborador", StringComparison.OrdinalIgnoreCase)))
            return ColaboradorPermissions;

        // Unknown / no role → no permissions
        return [];
    }

    /// <summary>
    /// Returns the permission list for Gestor / Compliance. 
    /// Exposing this as fallback inside Gestor block.
    /// </summary>
    private static IReadOnlyList<string> GestorPermissions => GestorCompliancePermissions;

    /// <summary>
    /// Returns the data-visibility scopes for the given set of role entities.
    /// Values read directly from the DB Role configuration.
    /// Most-permissive profile level combinations win.
    /// </summary>
    public static (ProfileVisibilityScope VisibilityScope, VagasDataScope VagasDataScope, ProfileAccessMode AccessMode)
        GetEffectiveScopes(IEnumerable<ApplicationRole> roles)
    {
        var roleList = roles.ToList();

        // Owner: can see everything but may not write transactions
        if (roleList.Any(r => string.Equals(r.Name, "Owner", StringComparison.OrdinalIgnoreCase)))
            return (ProfileVisibilityScope.FullStructure, VagasDataScope.All, ProfileAccessMode.ReadOnly);

        if (!roleList.Any())
            return (ProfileVisibilityScope.FullStructure, VagasDataScope.All, ProfileAccessMode.Full);

        // Calculate most permissive scopes across all assigned roles
        var visibility = roleList.Min(r => r.VisibilityScope); // FullStructure (0) < Restricted (1)
        var vagasScope = roleList.Min(r => r.VagasDataScope); // All (0) < ByArea (1) < ByRecrutador (2)
        var accessMode = roleList.Min(r => r.AccessMode); // Full (0) < ReadOnly (1)

        return (visibility, vagasScope, accessMode);
    }
}
