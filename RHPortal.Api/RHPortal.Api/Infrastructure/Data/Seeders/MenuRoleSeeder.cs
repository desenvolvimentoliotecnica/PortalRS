using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

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

            await MenuSeeder.EnsureAsync(db, adminRole, localizer, ct);
            await EnsureOperationalRoleMenusAsync(db, roleManager, localizer, ct);
            await EnsureGestorAndRecruiterRoleMenusAsync(db, roleManager, localizer, ct);
        }
    }

    private static async Task EnsureGestorAndRecruiterRoleMenusAsync(
        AppDbContext db,
        RoleManager<ApplicationRole> roleManager,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct)
    {
        var operationalMenus = await db.Menus
            .AsNoTracking()
            .Where(x => x.IsActive
                        && !string.IsNullOrWhiteSpace(x.Route)
                        && !string.IsNullOrWhiteSpace(x.PermissionKey)
                        && !x.Route.ToLower().StartsWith("/admin"))
            .Select(x => new { x.Id, x.PermissionKey })
            .ToListAsync(ct);

        if (operationalMenus.Count == 0)
            return;

        foreach (var (roleName, descriptionKey) in new[] { ("Gestor", "Seed.GestorRoleDescription"), ("Recrutador", "Seed.RecruiterRoleDescription") })
        {
            var role = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == roleName, ct);
            if (role is null)
            {
                role = new ApplicationRole
                {
                    Id = Guid.NewGuid(),
                    Name = roleName,
                    Description = localizer[descriptionKey],
                    IsActive = true,
                    VisibilityScope = roleName == "Gestor" ? ProfileVisibilityScope.RestrictedByAreaOrRecruiter : ProfileVisibilityScope.FullStructure,
                    VagasDataScope = roleName == "Gestor" ? VagasDataScope.ByArea : VagasDataScope.All,
                    AccessMode = ProfileAccessMode.Full
                };
                var roleResult = await roleManager.CreateAsync(role);
                if (!roleResult.Succeeded)
                    throw new InvalidOperationException(string.Join("; ", roleResult.Errors.Select(x => x.Description)));
            }
            else if (roleName == "Gestor")
            {
                role.VisibilityScope = ProfileVisibilityScope.RestrictedByAreaOrRecruiter;
                role.VagasDataScope = VagasDataScope.ByArea;
                role.AccessMode = ProfileAccessMode.Full;
                await roleManager.UpdateAsync(role);
            }

            var existing = await db.RoleMenus
                .Where(x => x.RoleId == role.Id)
                .Select(x => new { x.MenuId, x.PermissionKey })
                .ToListAsync(ct);

            var existingKeys = existing
                .Select(x => $"{x.MenuId}:{x.PermissionKey}")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var toAdd = operationalMenus
                .Where(x => !existingKeys.Contains($"{x.Id}:{x.PermissionKey}"))
                .Select(x => new RoleMenu
                {
                    Id = Guid.NewGuid(),
                    RoleId = role.Id,
                    MenuId = x.Id,
                    PermissionKey = x.PermissionKey
                })
                .ToList();

            if (toAdd.Count > 0)
            {
                db.RoleMenus.AddRange(toAdd);
                await db.SaveChangesAsync(ct);
            }
        }
    }

    private static async Task EnsureOperationalRoleMenusAsync(
        AppDbContext db,
        RoleManager<ApplicationRole> roleManager,
        IStringLocalizer<SeedMessages> localizer,
        CancellationToken ct)
    {
        var role = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Operacional", ct);
        if (role is null)
        {
            role = new ApplicationRole
            {
                Id = Guid.NewGuid(),
                Name = "Operacional",
                Description = localizer["Seed.OperationalRoleDescription"],
                IsActive = true
            };

            var roleResult = await roleManager.CreateAsync(role);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", roleResult.Errors.Select(x => x.Description)));
        }

        var menus = await db.Menus
            .AsNoTracking()
            .Where(x => x.IsActive
                        && !string.IsNullOrWhiteSpace(x.Route)
                        && !string.IsNullOrWhiteSpace(x.PermissionKey)
                        && !x.Route.ToLower().StartsWith("/admin"))
            .Select(x => new { x.Id, x.PermissionKey })
            .ToListAsync(ct);

        if (menus.Count == 0)
            return;

        var existing = await db.RoleMenus
            .Where(x => x.RoleId == role.Id)
            .Select(x => new { x.MenuId, x.PermissionKey })
            .ToListAsync(ct);

        var existingKeys = existing
            .Select(x => $"{x.MenuId}:{x.PermissionKey}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var toAdd = menus
            .Where(x => !existingKeys.Contains($"{x.Id}:{x.PermissionKey}"))
            .Select(x => new RoleMenu
            {
                Id = Guid.NewGuid(),
                RoleId = role.Id,
                MenuId = x.Id,
                PermissionKey = x.PermissionKey
            })
            .ToList();

        if (toAdd.Count == 0)
            return;

        db.RoleMenus.AddRange(toAdd);
        await db.SaveChangesAsync(ct);
    }
}
