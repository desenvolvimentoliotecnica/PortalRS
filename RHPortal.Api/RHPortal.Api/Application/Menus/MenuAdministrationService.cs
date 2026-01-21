using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Menus;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Menus;

public sealed class MenuAdministrationService
{
    private readonly AppDbContext _db;

    public MenuAdministrationService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<MenuListItemResponse>> ListAsync(CancellationToken ct)
    {
        return await _db.Menus
            .AsNoTracking()
            .OrderBy(x => x.Order)
            .ThenBy(x => x.DisplayName)
            .Select(x => new MenuListItemResponse(
                x.Id,
                x.DisplayName,
                x.Route,
                x.Icon,
                x.Order,
                x.ParentId,
                x.PermissionKey,
                x.IsActive,
                x.OpenInNewTab))
            .ToListAsync(ct);
    }

    public async Task<MenuResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        return await _db.Menus
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new MenuResponse(
                x.Id,
                x.DisplayName,
                x.Route,
                x.Icon,
                x.Order,
                x.ParentId,
                x.PermissionKey,
                x.IsActive,
                x.OpenInNewTab,
                x.CreatedAtUtc,
                x.UpdatedAtUtc))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<MenuResponse> CreateAsync(MenuCreateRequest request, CancellationToken ct)
    {
        var permissionKey = request.PermissionKey.Trim();
        var displayName = request.DisplayName.Trim();
        var route = request.Route.Trim();

        if (string.IsNullOrWhiteSpace(permissionKey))
            throw new InvalidOperationException("Permission key is required.");

        var exists = await _db.Menus.AnyAsync(x => x.PermissionKey == permissionKey, ct);
        if (exists)
            throw new InvalidOperationException("Permission key already exists.");

        var menu = new Menu
        {
            Id = Guid.NewGuid(),
            DisplayName = displayName,
            Route = route,
            Icon = request.Icon?.Trim() ?? string.Empty,
            Order = request.Order,
            ParentId = request.ParentId,
            PermissionKey = permissionKey,
            IsActive = request.IsActive,
            OpenInNewTab = request.OpenInNewTab
        };

        _db.Menus.Add(menu);
        await _db.SaveChangesAsync(ct);

        var created = await GetByIdAsync(menu.Id, ct);
        return created!;
    }

    public async Task<MenuResponse?> UpdateAsync(Guid id, MenuUpdateRequest request, CancellationToken ct)
    {
        var menu = await _db.Menus.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (menu is null) return null;

        var permissionKey = request.PermissionKey.Trim();
        if (!string.Equals(menu.PermissionKey, permissionKey, StringComparison.OrdinalIgnoreCase))
        {
            var exists = await _db.Menus.AnyAsync(x => x.PermissionKey == permissionKey && x.Id != id, ct);
            if (exists)
                throw new InvalidOperationException("Permission key already exists.");

            menu.PermissionKey = permissionKey;
        }

        menu.DisplayName = request.DisplayName.Trim();
        menu.Route = request.Route.Trim();
        menu.Icon = request.Icon?.Trim() ?? string.Empty;
        menu.Order = request.Order;
        menu.ParentId = request.ParentId;
        menu.IsActive = request.IsActive;
        menu.OpenInNewTab = request.OpenInNewTab;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var menu = await _db.Menus.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (menu is null) return false;

        _db.Menus.Remove(menu);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<MenuForCurrentUserResponse>> ListForUserAsync(Guid userId, CancellationToken ct)
    {
        var roleIds = await _db.UserRoles
            .Where(x => x.UserId == userId)
            .Select(x => x.RoleId)
            .Distinct()
            .ToListAsync(ct);

        var menuIds = await _db.RoleMenus
            .Where(x => roleIds.Contains(x.RoleId))
            .Select(x => x.MenuId)
            .Distinct()
            .ToListAsync(ct);

        return await _db.Menus
            .AsNoTracking()
            .Where(x => menuIds.Contains(x.Id) && x.IsActive)
            .OrderBy(x => x.Order)
            .ThenBy(x => x.DisplayName)
            .Select(x => new MenuForCurrentUserResponse(
                x.Id,
                x.DisplayName,
                x.Route,
                x.Icon,
                x.Order,
                x.ParentId,
                x.PermissionKey,
                x.OpenInNewTab))
            .ToListAsync(ct);
    }
}
