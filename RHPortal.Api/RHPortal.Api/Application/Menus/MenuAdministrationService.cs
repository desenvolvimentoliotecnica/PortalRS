using System.Globalization;
using System.Resources;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Menus;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Application.Menus;

public sealed class MenuAdministrationService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;
    private static readonly ResourceManager SeedResourceManager = new(
        $"{typeof(SeedMessages).Assembly.GetName().Name}.Resources.Infrastructure.Localization.SeedMessages",
        typeof(SeedMessages).Assembly);
    private static readonly IReadOnlyDictionary<string, string> DisplayNameKeysByPermission =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["dashboard.view"] = "Seed.Menu.Dashboard",
            ["agenda.view"] = "Seed.Menu.Agenda",
            ["vagas.view"] = "Seed.Menu.Vagas",
            ["candidatos.view"] = "Seed.Menu.Candidatos",
            ["triagem.view"] = "Seed.Menu.Triagem",
            ["matching.view"] = "Seed.Menu.Matching",
            ["portalvagas.view"] = "Seed.Menu.PortalVagas",
            ["entrada.view"] = "Seed.Menu.Entrada",
            ["relatorios.view"] = "Seed.Menu.Relatorios",
            ["departments.view"] = "Seed.Menu.Departamentos",
            ["costcenters.view"] = "Seed.Menu.CentrosCustos",
            ["areas.view"] = "Seed.Menu.Areas",
            ["categories.view"] = "Seed.Menu.Categorias",
            ["jobpositions.view"] = "Seed.Menu.Cargos",
            ["units.view"] = "Seed.Menu.Unidades",
            ["managers.view"] = "Seed.Menu.Gestores",
            ["users.read"] = "Seed.Menu.Usuarios",
            ["roles.manage"] = "Seed.Menu.Perfis",
            ["menus.manage"] = "Seed.Menu.Menus",
            ["access.manage"] = "Seed.Menu.Acessos",
            ["audit.view"] = "Seed.Menu.LogsTransacionais",
            ["logs.view"] = "Seed.Menu.LogsOperacionais",
            ["email-templates.manage"] = "Seed.Menu.TemplatesEmail",
            ["emails.manage"] = "Seed.Menu.Emails",
            ["email-config.manage"] = "Seed.Menu.ConfigEmail",
            ["entra-config.manage"] = "Seed.Menu.ConfigEntraId",
            ["localization-config.manage"] = "Seed.Menu.Idioma"
        };

    public MenuAdministrationService(
        AppDbContext db,
        IStringLocalizer<ServiceMessages> localizer)
    {
        _db = db;
        _localizer = localizer;
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
            throw new InvalidOperationException(_localizer["ServiceErrors.MenuPermissionRequired"]);

        var exists = await _db.Menus.AnyAsync(x => x.PermissionKey == permissionKey, ct);
        if (exists)
            throw new InvalidOperationException(_localizer["ServiceErrors.MenuPermissionExists"]);

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
                throw new InvalidOperationException(_localizer["ServiceErrors.MenuPermissionExists"]);

            menu.PermissionKey = permissionKey;
        }

        var displayName = request.DisplayName.Trim();
        if (!string.Equals(menu.DisplayName, displayName, StringComparison.Ordinal))
        {
            menu.DisplayName = displayName;
            if (!string.IsNullOrWhiteSpace(menu.DisplayNameKey))
                menu.DisplayNameKey = null;
        }
        else
        {
            menu.DisplayName = displayName;
        }
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

        var menus = await _db.Menus
            .Where(x => menuIds.Contains(x.Id) && x.IsActive)
            .ToListAsync(ct);

        if (TryBackfillDisplayNameKeys(menus))
            await _db.SaveChangesAsync(ct);

        return menus
            .Select(x => new MenuForCurrentUserResponse(
                x.Id,
                ResolveDisplayName(x),
                x.Route,
                x.Icon,
                x.Order,
                x.ParentId,
                x.PermissionKey,
                x.OpenInNewTab))
            .OrderBy(x => x.Order)
            .ThenBy(x => x.DisplayName)
            .ToList();
    }

    public async Task EnsureLocalizedDisplayNamesAsync(string? uiCulture, CancellationToken ct)
    {
        var menus = await _db.Menus.ToListAsync(ct);
        if (menus.Count == 0)
            return;

        var updated = false;
        foreach (var menu in menus)
        {
            if (!DisplayNameKeysByPermission.TryGetValue(menu.PermissionKey, out var key))
                continue;

            if (string.IsNullOrWhiteSpace(menu.DisplayNameKey)
                && IsDefaultDisplayName(menu.DisplayName, key))
            {
                menu.DisplayNameKey = key;
                updated = true;
            }

            if (!string.IsNullOrWhiteSpace(menu.DisplayNameKey)
                && !string.IsNullOrWhiteSpace(uiCulture))
            {
                var localizedName = GetSeedValue(uiCulture, menu.DisplayNameKey);
                if (!string.IsNullOrWhiteSpace(localizedName)
                    && !string.Equals(menu.DisplayName, localizedName, StringComparison.Ordinal))
                {
                    menu.DisplayName = localizedName;
                    updated = true;
                }
            }
        }

        if (updated)
            await _db.SaveChangesAsync(ct);
    }

    private bool TryBackfillDisplayNameKeys(List<Menu> menus)
    {
        var updated = false;

        foreach (var menu in menus)
        {
            if (!string.IsNullOrWhiteSpace(menu.DisplayNameKey))
                continue;

            if (!DisplayNameKeysByPermission.TryGetValue(menu.PermissionKey, out var key))
                continue;

            if (!IsDefaultDisplayName(menu.DisplayName, key))
                continue;

            menu.DisplayNameKey = key;
            updated = true;
        }

        return updated;
    }

    private static bool IsDefaultDisplayName(
        string displayName,
        string key)
    {
        var ptValue = GetSeedValue("pt-BR", key);
        if (!string.IsNullOrWhiteSpace(ptValue)
            && string.Equals(displayName, ptValue, StringComparison.OrdinalIgnoreCase))
            return true;

        var enValue = GetSeedValue("en-US", key);
        return !string.IsNullOrWhiteSpace(enValue)
               && string.Equals(displayName, enValue, StringComparison.OrdinalIgnoreCase);
    }

    private static string? GetSeedValue(string cultureName, string key)
    {
        var culture = CultureInfo.GetCultureInfo(cultureName);
        return SeedResourceManager.GetString(key, culture);
    }

    private string ResolveDisplayName(Menu menu)
    {
        if (!string.IsNullOrWhiteSpace(menu.DisplayNameKey))
        {
            var value = GetSeedValue(CultureInfo.CurrentUICulture.Name, menu.DisplayNameKey);
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }

        return menu.DisplayName;
    }
}
