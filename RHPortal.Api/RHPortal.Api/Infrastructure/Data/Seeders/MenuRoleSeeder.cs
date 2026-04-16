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
            var adminRole = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Admin", ct);
            if (adminRole is null)
                continue;

            // Keep menu definitions up to date (used by admin UI for display)
            await MenuSeeder.EnsureAsync(db, adminRole, localizer, ct);

            // Ensure standard roles exist so admins can assign them to users
            await EnsureRolesExistAsync(roleManager, localizer, ct);
        }
    }

    /// <summary>
    /// Ensures Operacional, Gestor, and Recrutador roles exist in the tenant.
    /// Does NOT write to RoleMenus — permissions come from RolePermissionManifest.
    /// </summary>
    private static async Task EnsureRolesExistAsync(
        RoleManager<ApplicationRole> roleManager,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct)
    {
        var roleDefs = new[]
        {
            new
            {
                Name = "Operacional",
                DescriptionKey = "Seed.OperationalRoleDescription",
                VisibilityScope = ProfileVisibilityScope.FullStructure,
                VagasDataScope = VagasDataScope.All,
                AccessMode = ProfileAccessMode.Full
            },
            new
            {
                Name = "Gestor",
                DescriptionKey = "Seed.GestorRoleDescription",
                VisibilityScope = ProfileVisibilityScope.RestrictedByAreaOrRecruiter,
                VagasDataScope = VagasDataScope.ByArea,
                AccessMode = ProfileAccessMode.Full
            },
            new
            {
                Name = "Recrutador",
                DescriptionKey = "Seed.RecruiterRoleDescription",
                VisibilityScope = ProfileVisibilityScope.FullStructure,
                VagasDataScope = VagasDataScope.All,
                AccessMode = ProfileAccessMode.Full
            },
        };

        foreach (var def in roleDefs)
        {
            var role = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == def.Name, ct);
            if (role is null)
            {
                role = new ApplicationRole
                {
                    Id = Guid.NewGuid(),
                    Name = def.Name,
                    Description = localizer[def.DescriptionKey],
                    IsActive = true,
                    VisibilityScope = def.VisibilityScope,
                    VagasDataScope = def.VagasDataScope,
                    AccessMode = def.AccessMode
                };

                var result = await roleManager.CreateAsync(role);
                if (!result.Succeeded)
                    throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));
            }
            else
            {
                // Keep scope settings current
                role.VisibilityScope = def.VisibilityScope;
                role.VagasDataScope = def.VagasDataScope;
                role.AccessMode = def.AccessMode;
                await roleManager.UpdateAsync(role);
            }
        }
    }
}
