using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Ensures default roles exist for every tenant.
/// RoleMenus seeding was removed — permissions are code-first via RolePermissionManifest.
/// This seeder only guarantees the role rows exist in AspNetRoles so admins can assign them.
/// </summary>
public static class MenuRoleSeeder
{
    public static async Task EnsureDefaultMenusAsync(
        MasterDbContext masterDb,
        IServiceProvider scope,
        ITenantContext tenantContext,
        RoleManager<ApplicationRole> roleManager,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct)
    {
        var tenants = await masterDb.Tenants
            .AsNoTracking()
            .Select(t => t.TenantId)
            .ToListAsync(ct);

        foreach (var tenantId in tenants)
        {
            tenantContext.SetTenantId(tenantId);
            var db = scope.GetRequiredService<AppDbContext>();
            // Ensure standard roles exist so admins can assign them to users.
            await EnsureRolesExistAsync(roleManager, localizer, ct);

            var adminRole = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Admin", ct);
            if (adminRole is null)
                continue;

            // Keep menu definitions up to date (used by admin UI for display)
            await MenuSeeder.EnsureAsync(db, adminRole, localizer, ct);
            await EnsureDefaultRoleMenuAccessAsync(db, ct);
        }
    }

    /// <summary>
    /// Ensures the standard tenant profiles exist.
    /// Does NOT write to RoleMenus — permissions come from RolePermissionManifest.
    /// </summary>
    public static async Task EnsureRolesExistAsync(
        RoleManager<ApplicationRole> roleManager,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct)
    {
        var roleDefs = BuildDefaultRoleDefinitions(localizer);

        foreach (var def in roleDefs)
        {
            var role = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == def.Name, ct);
            if (role is null)
            {
                role = new ApplicationRole
                {
                    Id = Guid.NewGuid(),
                    Name = def.Name,
                    Description = def.Description,
                    IsActive = true,
                    VisibilityScope = def.VisibilityScope,
                    VagasDataScope = def.VagasDataScope,
                    AccessMode = def.AccessMode,
                    Tipo = def.Tipo,
                    UseCustomPermissions = def.UseCustomPermissions
                };

                var result = await roleManager.CreateAsync(role);
                if (!result.Succeeded)
                    throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));
            }
            else
            {
                // Keep scope settings current
                role.Description = def.Description;
                role.IsActive = true;
                role.VisibilityScope = def.VisibilityScope;
                role.VagasDataScope = def.VagasDataScope;
                role.AccessMode = def.AccessMode;
                role.Tipo = def.Tipo;
                role.UseCustomPermissions = def.UseCustomPermissions;
                await roleManager.UpdateAsync(role);
            }
        }
    }

    public static async Task EnsureDefaultRoleMenuAccessAsync(AppDbContext db, CancellationToken ct)
    {
        var roleAccess = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["Analista de RH"] =
            [
                "dashboard.view",
                "sla.dashboard.view",
                "sla.etapas.manage",
                "solicitacoes-vaga.view",
                "vagas.view",
                "candidatos.view",
                "propostas-vaga.view",
                "processo-seletivo.view",
                "admissao.view",
                "agenda.view",
                "feedback.send",
                "feedback.view",
                "feedback.gamificacao.view",
                "gestao.dashboard",
                "portalvagas.view",
                "talentos.view",
                "projetos.view",
                "documentacao-padrao.manage",
                "folha.desligamentos.view",
                "folha.entrevista-saida.manage",
            ],
            ["Especialista de RH"] =
            [
                "dashboard.view",
                "sla.dashboard.view",
                "sla.etapas.manage",
                "solicitacoes-vaga.view",
                "feedback.send",
                "feedback.view",
                "feedback.gamificacao.view",
                "folha.desligamentos.view",
                "folha.entrevista-saida.manage",
            ],
        };

        var roles = await db.Roles
            .Where(x => roleAccess.Keys.Contains(x.Name!))
            .ToListAsync(ct);

        if (roles.Count == 0)
            return;

        var permissionKeys = roleAccess.Values.SelectMany(x => x).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var menusByPermission = await db.Menus
            .Where(x => permissionKeys.Contains(x.PermissionKey))
            .ToDictionaryAsync(x => x.PermissionKey, x => x, StringComparer.OrdinalIgnoreCase, ct);

        var roleIds = roles.Select(x => x.Id).ToList();
        var existingAssignments = await db.RoleMenus
            .Where(x => roleIds.Contains(x.RoleId))
            .Select(x => new { x.RoleId, x.PermissionKey })
            .ToListAsync(ct);

        var existing = existingAssignments
            .Select(x => $"{x.RoleId:N}|{x.PermissionKey}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var now = DateTimeOffset.UtcNow;
        var changed = false;

        foreach (var role in roles)
        {
            if (string.IsNullOrWhiteSpace(role.Name) || !roleAccess.TryGetValue(role.Name, out var access))
                continue;

            role.UseCustomPermissions = true;
            role.UpdatedAtUtc = now;
            changed = true;

            foreach (var permissionKey in access)
            {
                if (!menusByPermission.TryGetValue(permissionKey, out var menu))
                    continue;

                var key = $"{role.Id:N}|{permissionKey}";
                if (existing.Contains(key))
                    continue;

                db.RoleMenus.Add(new RoleMenu
                {
                    Id = Guid.NewGuid(),
                    TenantId = role.TenantId,
                    RoleId = role.Id,
                    MenuId = menu.Id,
                    PermissionKey = permissionKey,
                    CreatedAtUtc = now,
                });
                existing.Add(key);
                changed = true;
            }
        }

        if (changed)
            await db.SaveChangesAsync(ct);
    }

    private static IReadOnlyList<DefaultRoleDefinition> BuildDefaultRoleDefinitions(IStringLocalizer<SeedMessages> localizer)
    {
        return
        [
            new(
                Name: "Admin",
                Description: "Administrador do sistema",
                VisibilityScope: ProfileVisibilityScope.FullStructure,
                VagasDataScope: VagasDataScope.All,
                AccessMode: ProfileAccessMode.Full,
                Tipo: RoleTipo.Colaborador,
                UseCustomPermissions: false),
            new(
                Name: "Administrador",
                Description: "Administrador do tenant — acesso total dentro do tenant.",
                VisibilityScope: ProfileVisibilityScope.FullStructure,
                VagasDataScope: VagasDataScope.All,
                AccessMode: ProfileAccessMode.Full,
                Tipo: RoleTipo.Colaborador,
                UseCustomPermissions: false),
            new(
                Name: "Analista de RH",
                Description: "Analista de RH",
                VisibilityScope: ProfileVisibilityScope.FullStructure,
                VagasDataScope: VagasDataScope.ByRecrutador,
                AccessMode: ProfileAccessMode.Full,
                Tipo: RoleTipo.Colaborador,
                UseCustomPermissions: true),
            new(
                Name: "Especialista de RH",
                Description: "Especialista de RH",
                VisibilityScope: ProfileVisibilityScope.FullStructure,
                VagasDataScope: VagasDataScope.All,
                AccessMode: ProfileAccessMode.Full,
                Tipo: RoleTipo.Colaborador,
                UseCustomPermissions: true),
            new(
                Name: "Gestor",
                Description: "Gestor",
                VisibilityScope: ProfileVisibilityScope.RestrictedByAreaOrRecruiter,
                VagasDataScope: VagasDataScope.ByArea,
                AccessMode: ProfileAccessMode.Full,
                Tipo: RoleTipo.Colaborador,
                UseCustomPermissions: false),
            new(
                Name: "Operacional",
                Description: "Acesso operacional",
                VisibilityScope: ProfileVisibilityScope.FullStructure,
                VagasDataScope: VagasDataScope.All,
                AccessMode: ProfileAccessMode.Full,
                Tipo: RoleTipo.Colaborador,
                UseCustomPermissions: false),
            new(
                Name: "Recrutador",
                Description: "Recrutador - vagas, candidatos, triagem e matching",
                VisibilityScope: ProfileVisibilityScope.FullStructure,
                VagasDataScope: VagasDataScope.All,
                AccessMode: ProfileAccessMode.Full,
                Tipo: RoleTipo.Colaborador,
                UseCustomPermissions: false),
        ];
    }

    private sealed record DefaultRoleDefinition(
        string Name,
        string Description,
        ProfileVisibilityScope VisibilityScope,
        VagasDataScope VagasDataScope,
        ProfileAccessMode AccessMode,
        RoleTipo Tipo,
        bool UseCustomPermissions);
}
