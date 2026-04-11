using System.Globalization;
using System.Resources;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Menus;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
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
            ["solicitacoes-vaga.view"] = "Seed.Menu.SolicitacoesVaga",
            ["aprovacoes-vaga.view"] = "Seed.Menu.Aprovacoes",
            ["projetos.view"] = "Seed.Menu.Rodadas",
            ["processo-seletivo.view"] = "Seed.Menu.ProcessoSeletivo",
            ["admissao.view"] = "Seed.Menu.Admissao",
            ["candidatos.view"] = "Seed.Menu.Candidatos",
            ["triagem.view"] = "Seed.Menu.Triagem",
            ["matching.view"] = "Seed.Menu.Matching",
            ["portalvagas.view"] = "Seed.Menu.PortalVagas",
            ["entrada.view"] = "Seed.Menu.Entrada",
            ["relatorios.view"] = "Seed.Menu.Relatorios",
            ["feedback.celebracao.view"] = "Seed.Menu.Celebracao",
            ["feedback.desenvolvimento"] = "Seed.Menu.Desenvolvimento",
            ["feedback.send"] = "Seed.Menu.EnviarFeedback",
            ["feedback.view"] = "Seed.Menu.Feedbacks",
            ["feedback.list"] = "Seed.Menu.Feedbacks",
            ["feedback.oneonone.view"] = "Seed.Menu.Reunioes1a1",
            // Pesquisas desativado temporariamente.
            // ["feedback.pesquisas.view"] = "Seed.Menu.Pesquisas",
            ["feedback.gamificacao.view"] = "Seed.Menu.Gamificacao",
            ["feedback.gestao.view"] = "Seed.Menu.Gestao",
            ["gestao.dashboard"] = "Seed.Menu.GestaoDashboard",
            ["gestao.planos"] = "Seed.Menu.GestaoPlanos",
            ["gestao.humor"] = "Seed.Menu.GestaoHumor",
            ["gestao.resumo"] = "Seed.Menu.GestaoResumo",
            ["departments.view"] = "Seed.Menu.Departamentos",
            ["areas.view"] = "Seed.Menu.Areas",
            ["categories.view"] = "Seed.Menu.Funcoes",
            ["jobpositions.view"] = "Seed.Menu.Cargos",
            ["units.view"] = "Seed.Menu.Unidades",
            ["funcionarios.view"] = "Seed.Menu.Funcionarios",
            ["bloqueio-pessoa.view"] = "Seed.Menu.BloqueioPessoa",
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
            ["localization-config.manage"] = "Seed.Menu.Idioma",
            ["aws-settings.manage"] = "Seed.Menu.ConfigAws"
        };

    /// <summary>Permission keys for tenant-config-only items; excluded from main menu (sidebar).</summary>
    private static readonly HashSet<string> ConfigOnlyPermissionKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        // Pesquisas desativado temporariamente.
        "feedback.pesquisas.view",
        // Item duplicado/deprecado da sidebar.
        "feedback.myplans.view",
        "access.manage",
        "menus.manage",
        "audit.view",
        "logs.view",
        "email-templates.manage",
        "emails.manage",
        "email-config.manage",
        "entra-config.manage",
        "localization-config.manage",
        // Hierarquia: mantém só admin.hierarquia.manage visível — os demais são aliases da mesma tela
        "admin.gestores.manage",
        "admin.regras-aprovacao.manage"
    };

    /// <summary>Permission keys visíveis apenas para o Owner — excluídos do sidebar de qualquer tenant.</summary>
    private static readonly HashSet<string> OwnerOnlyPermissionKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "aws-settings.manage"
    };

    private static IReadOnlyList<MenuForCurrentUserResponse> ExcludeConfigOnlyMenus(IReadOnlyList<MenuForCurrentUserResponse> menus) =>
        menus.Where(m => !ConfigOnlyPermissionKeys.Contains(m.PermissionKey)).ToList();

    private static IReadOnlyList<MenuForCurrentUserResponse> ExcludeOwnerOnlyMenus(IReadOnlyList<MenuForCurrentUserResponse> menus) =>
        menus.Where(m => !OwnerOnlyPermissionKeys.Contains(m.PermissionKey)).ToList();

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

    /// <summary>
    /// Returns all active menus (no role filter). Used when the current user is Owner.
    /// </summary>
    public async Task<IReadOnlyList<MenuForCurrentUserResponse>> ListAllActiveForCurrentUserAsync(CancellationToken ct)
    {
        var menus = await _db.Menus
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(ct);
        var mapped = await MapMenusForCurrentUserAsync(menus, ct);
        return ExcludeConfigOnlyMenus(mapped);
    }

    private const int OwnerFullMenuMinimumCount = 5;

    /// <summary>
    /// Returns full menu list for Owner. Merges DB menus with the hardcoded template so new
    /// descriptors always appear even before the seeder has run for the tenant.
    /// </summary>
    public async Task<IReadOnlyList<MenuForCurrentUserResponse>> ListFullMenuForOwnerAsync(CancellationToken ct)
    {
        var fromDb = await ListAllActiveForCurrentUserAsync(ct);
        if (fromDb.Count < OwnerFullMenuMinimumCount)
            return ExcludeConfigOnlyMenus(BuildFullMenuTemplate());

        // Merge: inject any template descriptors missing from the DB (e.g. newly added items not yet seeded)
        var template = BuildFullMenuTemplate();
        var dbPermKeys = fromDb.Select(x => x.PermissionKey).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = template.Where(x => !dbPermKeys.Contains(x.PermissionKey)).ToList();
        if (missing.Count == 0)
            return fromDb;

        var merged = fromDb.Concat(missing).OrderBy(x => x.Order).ThenBy(x => x.DisplayName).ToList();
        return ExcludeConfigOnlyMenus(merged);
    }

    private static IReadOnlyList<MenuForCurrentUserResponse> BuildFullMenuTemplate()
    {
        var culture = CultureInfo.CurrentUICulture;
        string L(string key)
        {
            var value = GetSeedValue(culture.Name, key);
            return string.IsNullOrWhiteSpace(value) ? key : value;
        }

        var descriptors = MenuSeeder.GetDefaultMenuDescriptors();
        var idByPermissionKey = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var d in descriptors)
            idByPermissionKey[d.PermissionKey] = Guid.NewGuid();

        var list = new List<MenuForCurrentUserResponse>(descriptors.Count);
        foreach (var d in descriptors)
        {
            var parentId = d.ParentPermissionKey != null && idByPermissionKey.TryGetValue(d.ParentPermissionKey, out var pid) ? pid : (Guid?)null;
            list.Add(new MenuForCurrentUserResponse(
                idByPermissionKey[d.PermissionKey],
                L(d.DisplayNameKey),
                d.Route,
                d.Icon,
                d.Order,
                parentId,
                d.PermissionKey,
                d.OpenInNewTab));
        }
        return list.OrderBy(x => x.Order).ThenBy(x => x.DisplayName).ToList();
    }

    public async Task<IReadOnlyList<MenuForCurrentUserResponse>> ListForUserAsync(
        Guid userId,
        IReadOnlyCollection<string>? permissionKeys,
        CancellationToken ct)
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

        if (menus.Count == 0 && permissionKeys is { Count: > 0 })
        {
            return await ListForPermissionsAsync(permissionKeys, ct);
        }

        menus = await IncludeAncestorMenusAsync(menus, ct);
        var mapped = await MapMenusForCurrentUserAsync(menus, ct);
        return ExcludeOwnerOnlyMenus(ExcludeConfigOnlyMenus(mapped));
    }

    public async Task<IReadOnlyList<MenuForCurrentUserResponse>> ListForPermissionsAsync(
        IReadOnlyCollection<string> permissionKeys,
        CancellationToken ct)
    {
        if (permissionKeys.Count == 0)
            return Array.Empty<MenuForCurrentUserResponse>();

        var menus = await _db.Menus
            .Where(x => permissionKeys.Contains(x.PermissionKey) && x.IsActive)
            .ToListAsync(ct);

        menus = await IncludeAncestorMenusAsync(menus, ct);
        var mapped = await MapMenusForCurrentUserAsync(menus, ct);
        return ExcludeOwnerOnlyMenus(ExcludeConfigOnlyMenus(mapped));
    }

    private async Task<List<Menu>> IncludeAncestorMenusAsync(List<Menu> menus, CancellationToken ct)
    {
        var idSet = menus.Select(x => x.Id).ToHashSet();
        var parentIds = menus.Where(x => x.ParentId.HasValue).Select(x => x.ParentId!.Value).Distinct().Where(id => !idSet.Contains(id)).ToList();
        while (parentIds.Count > 0)
        {
            var parents = await _db.Menus.Where(x => parentIds.Contains(x.Id) && x.IsActive).ToListAsync(ct);
            foreach (var p in parents)
            {
                if (!idSet.Contains(p.Id))
                {
                    idSet.Add(p.Id);
                    menus.Add(p);
                }
            }
            parentIds = parents.Where(x => x.ParentId.HasValue).Select(x => x.ParentId!.Value).Distinct().Where(id => !idSet.Contains(id)).ToList();
        }
        return menus;
    }

    private async Task<IReadOnlyList<MenuForCurrentUserResponse>> MapMenusForCurrentUserAsync(
        List<Menu> menus,
        CancellationToken ct)
    {
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
        try
        {
            var culture = CultureInfo.GetCultureInfo(cultureName);
            return SeedResourceManager.GetString(key, culture);
        }
        catch (MissingManifestResourceException)
        {
            return null;
        }
    }

    private string ResolveDisplayName(Menu menu)
    {
        if (!string.IsNullOrWhiteSpace(menu.DisplayNameKey))
        {
            var value = GetSeedValue(CultureInfo.CurrentUICulture.Name, menu.DisplayNameKey);
            if (string.IsNullOrWhiteSpace(value))
                value = GetSeedValue("pt-BR", menu.DisplayNameKey);
            if (string.IsNullOrWhiteSpace(value))
                value = GetSeedValue("en-US", menu.DisplayNameKey);
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }

        // Defensive fallback for legacy rows where DisplayName persisted as resource key.
        if (!string.IsNullOrWhiteSpace(menu.DisplayName) && menu.DisplayName.StartsWith("Seed.Menu.", StringComparison.Ordinal))
        {
            var byCurrent = GetSeedValue(CultureInfo.CurrentUICulture.Name, menu.DisplayName);
            if (!string.IsNullOrWhiteSpace(byCurrent))
                return byCurrent;

            var byPtBr = GetSeedValue("pt-BR", menu.DisplayName);
            if (!string.IsNullOrWhiteSpace(byPtBr))
                return byPtBr;

            var byEnUs = GetSeedValue("en-US", menu.DisplayName);
            if (!string.IsNullOrWhiteSpace(byEnUs))
                return byEnUs;
        }

        return menu.DisplayName;
    }
}
