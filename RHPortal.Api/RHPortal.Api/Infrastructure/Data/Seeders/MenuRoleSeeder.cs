using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class MenuRoleSeeder
{
    public static async Task EnsureDefaultMenusAsync(
        AppDbContext db,
        ITenantContext tenantContext,
        RoleManager<ApplicationRole> roleManager,
        CancellationToken ct)
    {
        var tenants = await db.Tenants
            .AsNoTracking()
            .Select(t => t.TenantId)
            .ToListAsync(ct);

        foreach (var tenantId in tenants)
        {
            tenantContext.SetTenantId(tenantId);
            var adminRole = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Admin", ct);
            if (adminRole is null)
                continue;

            await MenuSeeder.EnsureAsync(db, adminRole, ct);
            await EnsureOperationalRoleMenusAsync(db, roleManager, ct);
        }
    }

    private static async Task EnsureOperationalRoleMenusAsync(
        AppDbContext db,
        RoleManager<ApplicationRole> roleManager,
        CancellationToken ct)
    {
        var role = await roleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Operacional", ct);
        if (role is null)
        {
            role = new ApplicationRole
            {
                Id = Guid.NewGuid(),
                Name = "Operacional",
                Description = "Acesso operacional",
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
