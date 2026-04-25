using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Navegacao;

namespace RhPortal.Api.Application.Owner;

public sealed class TenantScreenService
{
    private readonly MasterDbContext _masterDb;

    public TenantScreenService(MasterDbContext masterDb)
    {
        _masterDb = masterDb;
    }

    /// <summary>
    /// Mapa navItemId → estado para o tenant. Itens sem registro não entram no mapa
    /// (o chamador trata ausência como "ativo").
    /// </summary>
    public async Task<Dictionary<string, string>> GetEstadoMapAsync(string tenantId, CancellationToken ct)
    {
        var rows = await _masterDb.TenantScreens
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.NavItemId, r => r.Estado, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Define o estado de uma tela para o tenant.
    /// Retorna false se o navItemId não existe no manifesto ou o estado é inválido.
    /// </summary>
    public async Task<bool> SetEstadoAsync(
        string tenantId,
        string navItemId,
        string estado,
        Guid? ownerId,
        CancellationToken ct)
    {
        if (!EstadoTela.IsValid(estado)) return false;

        var itemExiste = NavegacaoManifest.Items.Any(i =>
            string.Equals(i.Id, navItemId, StringComparison.OrdinalIgnoreCase));
        if (!itemExiste) return false;

        var row = await _masterDb.TenantScreens
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.NavItemId == navItemId, ct);

        var now = DateTimeOffset.UtcNow;
        if (row is null)
        {
            row = new TenantScreen
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                NavItemId = navItemId,
                Estado = estado,
                UpdatedAtUtc = now,
                UpdatedByOwnerId = ownerId
            };
            _masterDb.TenantScreens.Add(row);
        }
        else
        {
            row.Estado = estado;
            row.UpdatedAtUtc = now;
            row.UpdatedByOwnerId = ownerId;
        }

        await _masterDb.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Garante que todos os itens do manifesto têm registro para o tenant com estado="ativo".
    /// Chamado no provisionamento do tenant.
    /// </summary>
    public async Task EnsureDefaultsAsync(string tenantId, CancellationToken ct)
    {
        var existing = await _masterDb.TenantScreens
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.NavItemId)
            .ToListAsync(ct);

        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var item in NavegacaoManifest.Items)
        {
            if (existingSet.Contains(item.Id)) continue;
            _masterDb.TenantScreens.Add(new TenantScreen
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                NavItemId = item.Id,
                Estado = EstadoTela.Ativo,
                UpdatedAtUtc = now
            });
        }

        await _masterDb.SaveChangesAsync(ct);
    }
}
