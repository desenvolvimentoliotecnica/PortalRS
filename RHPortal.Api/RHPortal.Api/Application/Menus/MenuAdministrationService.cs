using System.Globalization;
using System.Resources;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Contracts.Menus;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Modules;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Menus;

public sealed class MenuAdministrationService
{
    private readonly AppDbContext _db;
    private readonly IStringLocalizer<ServiceMessages> _localizer;
    private readonly TenantModuleService _moduleService;
    private readonly ITenantContext _tenantContext;
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
            ["propostas-vaga.view"] = "Seed.Menu.PropostasVaga",
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
            ["documentacao-padrao.manage"] = "Seed.Menu.DocumentacaoPadrao",
            ["audit.view"] = "Seed.Menu.LogsTransacionais",
            ["logs.view"] = "Seed.Menu.LogsOperacionais",
            ["email-templates.manage"] = "Seed.Menu.TemplatesEmail",
            ["emails.manage"] = "Seed.Menu.Emails",
            ["email-config.manage"] = "Seed.Menu.ConfigEmail",
            ["entra-config.manage"] = "Seed.Menu.ConfigEntraId",
            ["localization-config.manage"] = "Seed.Menu.Idioma",
            ["integracao-totvs.view"] = "Seed.Menu.IntegracaoTotvs",
            ["aws-settings.manage"] = "Seed.Menu.ConfigAws"
        };

    /// <summary>Permission keys for tenant-config-only items; excluded from main menu (sidebar).</summary>
    private static readonly HashSet<string> ConfigOnlyPermissionKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        // Pesquisas desativado temporariamente.
        "feedback.pesquisas.view",
        // Item duplicado/deprecado da sidebar.
        "feedback.myplans.view",
        "aprovacoes-vaga.view",
        "solicitacoes-vaga.view",
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
        "aws-settings.manage",
        "aprovacoes-vaga.view",
    };

    private static IReadOnlyList<MenuForCurrentUserResponse> ExcludeConfigOnlyMenus(IReadOnlyList<MenuForCurrentUserResponse> menus) =>
        menus.Where(m => !ConfigOnlyPermissionKeys.Contains(m.PermissionKey)).ToList();

    private static IReadOnlyList<MenuForCurrentUserResponse> ExcludeOwnerOnlyMenus(IReadOnlyList<MenuForCurrentUserResponse> menus) =>
        menus.Where(m => !OwnerOnlyPermissionKeys.Contains(m.PermissionKey)).ToList();

    public MenuAdministrationService(
        AppDbContext db,
        IStringLocalizer<ServiceMessages> localizer,
        TenantModuleService moduleService,
        ITenantContext tenantContext)
    {
        _db = db;
        _localizer = localizer;
        _moduleService = moduleService;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Remove menus cujo módulo correspondente está desabilitado para o tenant atual.
    /// Menus com permissionKey que não mapeiam para nenhum módulo do catálogo passam livremente.
    /// </summary>
    private async Task<IReadOnlyList<MenuForCurrentUserResponse>> FilterByEnabledModulesAsync(
        IReadOnlyList<MenuForCurrentUserResponse> menus,
        CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId) || string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
            return menus;

        var enabled = await _moduleService.GetEnabledModuleKeysAsync(tenantId, ct);
        return menus.Where(m =>
        {
            var moduleKey = ModuleCatalog.ResolveModuleKey(m.PermissionKey);
            return moduleKey is null || enabled.Contains(moduleKey);
        }).ToList();
    }

    public async Task<IReadOnlyList<MenuListItemResponse>> ListAsync(CancellationToken ct)
    {
        await EnsureDefaultMenusPresentAsync(ct);

        var menus = await _db.Menus
            .AsNoTracking()
            .OrderBy(x => x.Order)
            .ThenBy(x => x.DisplayName)
            .ToListAsync(ct);

        return menus
            .Select(x => new MenuListItemResponse(
                x.Id,
                ResolveDisplayName(x),
                x.Route,
                x.Icon,
                x.Order,
                x.ParentId,
                x.PermissionKey,
                x.IsActive,
                x.OpenInNewTab))
            .OrderBy(x => x.Order)
            .ThenBy(x => x.DisplayName)
            .ToList();
    }

    private async Task EnsureDefaultMenusPresentAsync(CancellationToken ct)
    {
        var descriptors = MenuSeeder.GetDefaultMenuDescriptors();
        var existingByPermission = await _db.Menus
            .ToDictionaryAsync(x => x.PermissionKey, x => x, StringComparer.OrdinalIgnoreCase, ct);

        var tenantId = _tenantContext.TenantId ?? string.Empty;
        var now = DateTimeOffset.UtcNow;
        var changed = false;
        var insertedPermissionKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var d in descriptors)
        {
            if (existingByPermission.ContainsKey(d.PermissionKey))
                continue;

            var menu = new Menu
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DisplayName = ResolveSeedDisplayName(d.DisplayNameKey),
                DisplayNameKey = d.DisplayNameKey,
                Route = d.Route,
                Icon = d.Icon,
                Order = d.Order,
                PermissionKey = d.PermissionKey,
                IsActive = true,
                OpenInNewTab = d.OpenInNewTab,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            };

            _db.Menus.Add(menu);
            existingByPermission[d.PermissionKey] = menu;
            insertedPermissionKeys.Add(d.PermissionKey);
            changed = true;
        }

        foreach (var d in descriptors.Where(x => x.ParentPermissionKey is not null))
        {
            if (!insertedPermissionKeys.Contains(d.PermissionKey))
                continue;
            if (!existingByPermission.TryGetValue(d.PermissionKey, out var child))
                continue;
            if (!existingByPermission.TryGetValue(d.ParentPermissionKey!, out var parent))
                continue;
            if (child.ParentId == parent.Id)
                continue;

            child.ParentId = parent.Id;
            child.UpdatedAtUtc = now;
            changed = true;
        }

        if (changed)
            await _db.SaveChangesAsync(ct);
    }

    private static string ResolveSeedDisplayName(string key)
    {
        var current = GetSeedValue(CultureInfo.CurrentUICulture.Name, key);
        if (!string.IsNullOrWhiteSpace(current))
            return current;

        var ptBr = GetSeedValue("pt-BR", key);
        if (!string.IsNullOrWhiteSpace(ptBr))
            return ptBr;

        var enUs = GetSeedValue("en-US", key);
        return string.IsNullOrWhiteSpace(enUs) ? key : enUs;
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
    /// Changed to only use Code-First template.
    /// </summary>
    public Task<IReadOnlyList<MenuForCurrentUserResponse>> ListAllActiveForCurrentUserAsync(CancellationToken ct)
    {
        return Task.FromResult<IReadOnlyList<MenuForCurrentUserResponse>>(ExcludeConfigOnlyMenus(BuildFullMenuTemplate()));
    }

    private const int OwnerFullMenuMinimumCount = 5;

    /// <summary>
    /// Returns full menu list for Owner. Purely code-first.
    /// </summary>
    public Task<IReadOnlyList<MenuForCurrentUserResponse>> ListFullMenuForOwnerAsync(CancellationToken ct)
    {
        return Task.FromResult<IReadOnlyList<MenuForCurrentUserResponse>>(ExcludeConfigOnlyMenus(BuildFullMenuTemplate()));
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
        // Permissions are code-first (RolePermissionManifest) and come from JWT claims.
        // The RoleMenus DB table is no longer the source of truth — delegate directly.
        if (permissionKeys is { Count: > 0 })
            return await ListForPermissionsAsync(permissionKeys, ct);

        return Array.Empty<MenuForCurrentUserResponse>();
    }

    public async Task<IReadOnlyList<MenuForCurrentUserResponse>> ListForPermissionsAsync(
        IReadOnlyCollection<string> permissionKeys,
        CancellationToken ct)
    {
        if (permissionKeys.Count == 0)
            return Array.Empty<MenuForCurrentUserResponse>();

        var allMenus = BuildFullMenuTemplate();

        var permittedMenus = permissionKeys.Contains("*")
            ? allMenus.ToList()
            : allMenus.Where(x => permissionKeys.Contains(x.PermissionKey)).ToList();

        // Include ancestors from memory
        var idSet = permittedMenus.Select(x => x.Id).ToHashSet();
        var parentIds = permittedMenus.Where(x => x.ParentId.HasValue).Select(x => x.ParentId!.Value).Distinct().Where(id => !idSet.Contains(id)).ToList();
        while (parentIds.Count > 0)
        {
            var parents = allMenus.Where(x => parentIds.Contains(x.Id)).ToList();
            foreach (var p in parents)
            {
                if (!idSet.Contains(p.Id))
                {
                    idSet.Add(p.Id);
                    permittedMenus.Add(p);
                }
            }
            parentIds = parents.Where(x => x.ParentId.HasValue).Select(x => x.ParentId!.Value).Distinct().Where(id => !idSet.Contains(id)).ToList();
        }

        var filtered = ExcludeOwnerOnlyMenus(ExcludeConfigOnlyMenus(permittedMenus.OrderBy(x => x.Order).ThenBy(x => x.DisplayName).ToList()));
        return await FilterByEnabledModulesAsync(filtered, ct);
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
