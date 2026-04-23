using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Modules;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Modules;

namespace RhPortal.Api.Application.Owner;

/// <summary>
/// Gerencia os pacotes comerciais (entitlement de alto nível) contratados por cada tenant.
/// Pacotes com <c>IsActive=false</c> no catálogo (ex.: Folha de Pagamento em construção) são ignorados —
/// não aparecem na listagem, não são semeados e não podem ser ligados.
/// </summary>
public sealed class TenantPackageService
{
    private readonly MasterDbContext _masterDb;

    public TenantPackageService(MasterDbContext masterDb)
    {
        _masterDb = masterDb;
    }

    /// <summary>
    /// Lista os pacotes disponíveis no catálogo (apenas <c>IsActive=true</c>) com o status
    /// contratado/não contratado para o tenant. Sem registro = habilitado por padrão
    /// (mesma semântica de <see cref="TenantModuleService.ListAsync"/>).
    /// </summary>
    public async Task<IReadOnlyList<TenantPackageResponse>> ListAsync(string tenantId, CancellationToken ct)
    {
        var rows = await _masterDb.TenantPackages
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(ct);

        var byKey = rows.ToDictionary(r => r.PackageKey, StringComparer.OrdinalIgnoreCase);

        return PackageCatalog.All
            .Where(p => p.IsActive)
            .Select(p =>
            {
                var row = byKey.TryGetValue(p.Key, out var r) ? r : null;
                return new TenantPackageResponse(
                    Key: p.Key,
                    Name: p.Name,
                    Description: p.Description,
                    IsActive: p.IsActive,
                    IsEnabled: row?.IsEnabled ?? true,
                    UpdatedAtUtc: row?.UpdatedAtUtc,
                    UpdatedByOwnerId: row?.UpdatedByOwnerId);
            })
            .ToList();
    }

    /// <summary>
    /// Liga ou desliga um pacote comercial para o tenant. Pacotes com
    /// <c>IsActive=false</c> no catálogo não podem ser ligados.
    /// </summary>
    public async Task<TenantPackageResponse?> SetEnabledAsync(
        string tenantId,
        string packageKey,
        bool isEnabled,
        Guid? ownerId,
        CancellationToken ct)
    {
        var package = PackageCatalog.GetByKey(packageKey);
        if (package is null) return null;

        if (!package.IsActive && isEnabled)
            throw new InvalidOperationException($"Pacote '{packageKey}' não está disponível para contratação.");

        var row = await _masterDb.TenantPackages
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.PackageKey == packageKey, ct);

        var now = DateTimeOffset.UtcNow;
        if (row is null)
        {
            row = new TenantPackage
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PackageKey = packageKey,
                IsEnabled = isEnabled,
                UpdatedAtUtc = now,
                UpdatedByOwnerId = ownerId
            };
            _masterDb.TenantPackages.Add(row);
        }
        else
        {
            row.IsEnabled = isEnabled;
            row.UpdatedAtUtc = now;
            row.UpdatedByOwnerId = ownerId;
        }

        await _masterDb.SaveChangesAsync(ct);

        return new TenantPackageResponse(
            Key: package.Key,
            Name: package.Name,
            Description: package.Description,
            IsActive: package.IsActive,
            IsEnabled: row.IsEnabled,
            UpdatedAtUtc: row.UpdatedAtUtc,
            UpdatedByOwnerId: row.UpdatedByOwnerId);
    }

    /// <summary>
    /// Garante que todos os pacotes ativos do catálogo existem para o tenant com <c>IsEnabled=true</c>.
    /// Chamado pelo <c>TenantProvisioningService</c> antes dos defaults de módulos.
    /// </summary>
    public async Task EnsureDefaultsAsync(string tenantId, CancellationToken ct)
    {
        var existing = await _masterDb.TenantPackages
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.PackageKey)
            .ToListAsync(ct);

        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var package in PackageCatalog.All)
        {
            if (!package.IsActive) continue;
            if (existingSet.Contains(package.Key)) continue;

            _masterDb.TenantPackages.Add(new TenantPackage
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PackageKey = package.Key,
                IsEnabled = true,
                UpdatedAtUtc = now
            });
        }

        await _masterDb.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Retorna o conjunto de package keys efetivamente ATIVOS para o tenant.
    /// Só entram pacotes com <c>IsActive=true</c> no catálogo. Pacote sem registro =
    /// habilitado por padrão (coerente com módulos).
    /// </summary>
    public async Task<HashSet<string>> GetEnabledPackageKeysAsync(string tenantId, CancellationToken ct)
    {
        var rows = await _masterDb.TenantPackages
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(ct);

        var byKey = rows.ToDictionary(r => r.PackageKey, r => r.IsEnabled, StringComparer.OrdinalIgnoreCase);
        var enabled = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var package in PackageCatalog.All)
        {
            if (!package.IsActive) continue;
            var isEnabled = byKey.TryGetValue(package.Key, out var v) ? v : true;
            if (isEnabled) enabled.Add(package.Key);
        }

        return enabled;
    }
}
