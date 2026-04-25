using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Navegacao;
using RhPortal.Api.Contracts.Modules;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Modules;

namespace RhPortal.Api.Application.Owner;

public sealed class TenantModuleService
{
    private readonly MasterDbContext _masterDb;
    private readonly TenantPackageService _packageService;
    private readonly TenantScreenService _screenService;

    public TenantModuleService(MasterDbContext masterDb, TenantPackageService packageService, TenantScreenService screenService)
    {
        _masterDb = masterDb;
        _packageService = packageService;
        _screenService = screenService;
    }

    /// <summary>
    /// Lista todos os módulos do catálogo com o status (ativo/inativo) para o tenant.
    /// Se um módulo ainda não tem registro no banco, retorna como habilitado (padrão: tudo ligado).
    /// </summary>
    public async Task<IReadOnlyList<TenantModuleResponse>> ListAsync(string tenantId, CancellationToken ct)
    {
        var rows = await _masterDb.TenantModules
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(ct);

        var byKey = rows.ToDictionary(r => r.ModuleKey, StringComparer.OrdinalIgnoreCase);

        return ModuleCatalog.All
            .Select(m =>
            {
                var row = byKey.TryGetValue(m.Key, out var r) ? r : null;
                return new TenantModuleResponse(
                    Key: m.Key,
                    Name: m.Name,
                    Description: m.Description,
                    IsCore: m.IsCore,
                    IsEnabled: m.IsCore || (row?.IsEnabled ?? true),
                    UpdatedAtUtc: row?.UpdatedAtUtc,
                    UpdatedByOwnerId: row?.UpdatedByOwnerId,
                    PackageKey: m.PackageKey);
            })
            .ToList();
    }

    /// <summary>
    /// Lista todos os módulos do catálogo com status por tenant E a lista de telas
    /// (derivadas do <see cref="NavegacaoManifest"/>) que cada módulo entrega.
    /// Usada pela tela do Owner para mostrar, em cada card de módulo, quais
    /// funcionalidades o cliente ganha ao contratar.
    /// </summary>
    public async Task<IReadOnlyList<TenantModuleDetailedResponse>> ListDetailedAsync(string tenantId, CancellationToken ct)
    {
        var rows = await _masterDb.TenantModules
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(ct);

        var byKey = rows.ToDictionary(r => r.ModuleKey, StringComparer.OrdinalIgnoreCase);
        var screenEstados = await _screenService.GetEstadoMapAsync(tenantId, ct);

        return ModuleCatalog.All
            .Select(m =>
            {
                var row = byKey.TryGetValue(m.Key, out var r) ? r : null;
                return new TenantModuleDetailedResponse(
                    Key: m.Key,
                    Name: m.Name,
                    Description: m.Description,
                    IsCore: m.IsCore,
                    IsEnabled: m.IsCore || (row?.IsEnabled ?? true),
                    UpdatedAtUtc: row?.UpdatedAtUtc,
                    UpdatedByOwnerId: row?.UpdatedByOwnerId,
                    PackageKey: m.PackageKey,
                    Telas: ModuleScreensResolver.GetScreensForModule(m.Key, screenEstados));
            })
            .ToList();
    }

    /// <summary>
    /// Liga ou desliga um módulo para o tenant. Módulos core (<see cref="ModuleCatalog.ModuleDefinition.IsCore"/>)
    /// não podem ser desabilitados.
    /// </summary>
    public async Task<TenantModuleResponse?> SetEnabledAsync(
        string tenantId,
        string moduleKey,
        bool isEnabled,
        Guid? ownerId,
        CancellationToken ct)
    {
        var module = ModuleCatalog.GetByKey(moduleKey);
        if (module is null) return null;

        if (module.IsCore && !isEnabled)
            throw new InvalidOperationException($"Módulo '{moduleKey}' é core e não pode ser desativado.");

        if (isEnabled && module.PackageKey is not null)
        {
            var package = PackageCatalog.GetByKey(module.PackageKey);
            if (package is null || !package.IsActive)
                throw new InvalidOperationException(
                    $"Módulo '{moduleKey}' pertence ao pacote '{module.PackageKey}', que não está disponível para contratação.");
        }

        var row = await _masterDb.TenantModules
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ModuleKey == moduleKey, ct);

        var now = DateTimeOffset.UtcNow;
        if (row is null)
        {
            row = new TenantModule
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ModuleKey = moduleKey,
                IsEnabled = isEnabled,
                UpdatedAtUtc = now,
                UpdatedByOwnerId = ownerId
            };
            _masterDb.TenantModules.Add(row);
        }
        else
        {
            row.IsEnabled = isEnabled;
            row.UpdatedAtUtc = now;
            row.UpdatedByOwnerId = ownerId;
        }

        await _masterDb.SaveChangesAsync(ct);

        return new TenantModuleResponse(
            Key: module.Key,
            Name: module.Name,
            Description: module.Description,
            IsCore: module.IsCore,
            IsEnabled: row.IsEnabled,
            UpdatedAtUtc: row.UpdatedAtUtc,
            UpdatedByOwnerId: row.UpdatedByOwnerId,
            PackageKey: module.PackageKey);
    }

    /// <summary>
    /// Garante que todos os módulos do catálogo existem para o tenant com <c>IsEnabled=true</c>.
    /// Chamado pelo <c>TenantProvisioningService</c> na criação do tenant.
    /// </summary>
    public async Task EnsureDefaultsAsync(string tenantId, CancellationToken ct)
    {
        var existing = await _masterDb.TenantModules
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.ModuleKey)
            .ToListAsync(ct);

        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var module in ModuleCatalog.All)
        {
            if (existingSet.Contains(module.Key)) continue;
            _masterDb.TenantModules.Add(new TenantModule
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ModuleKey = module.Key,
                IsEnabled = true,
                UpdatedAtUtc = now
            });
        }

        await _masterDb.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Retorna o conjunto de module keys EFETIVAMENTE ativos para o tenant. Usado pelos filtros de menu/permissão.
    /// Regras:
    ///   - módulos core: sempre ativos;
    ///   - módulos com <c>PackageKey</c>: só ativos se o pacote-pai também estiver ativo no catálogo e
    ///     habilitado para o tenant;
    ///   - módulos sem registro são considerados habilitados por padrão (mesma regra de hoje).
    /// </summary>
    public async Task<HashSet<string>> GetEnabledModuleKeysAsync(string tenantId, CancellationToken ct)
    {
        var rows = await _masterDb.TenantModules
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(ct);

        var byKey = rows.ToDictionary(r => r.ModuleKey, r => r.IsEnabled, StringComparer.OrdinalIgnoreCase);
        var enabledPackages = await _packageService.GetEnabledPackageKeysAsync(tenantId, ct);
        var enabled = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var module in ModuleCatalog.All)
        {
            if (module.IsCore)
            {
                enabled.Add(module.Key);
                continue;
            }

            var moduleOn = byKey.TryGetValue(module.Key, out var v) ? v : true;
            if (!moduleOn) continue;

            if (module.PackageKey is not null && !enabledPackages.Contains(module.PackageKey))
                continue;

            enabled.Add(module.Key);
        }

        return enabled;
    }
}
