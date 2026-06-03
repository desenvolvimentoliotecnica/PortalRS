using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante o mapa padrão de CODSTATUS RM para status do Portal por tenant.
/// Idempotente: não sobrescreve mapas já cadastrados pelo usuário.
/// </summary>
public static class RmRequisicaoStatusMapSeeder
{
    private static readonly (int CodStatusRm, SolicitacaoStatus PortalStatus)[] Defaults =
    [
        (1, SolicitacaoStatus.EmAndamento),
        (2, SolicitacaoStatus.Reprovada),
        (3, SolicitacaoStatus.Aprovada),
        (4, SolicitacaoStatus.Concluida),
        (5, SolicitacaoStatus.PendenteAprovacao),
        (6, SolicitacaoStatus.Cancelada),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("RmRequisicaoStatusMapSeeder requer um tenantId.");

        var existingCodStatus = await db.RmRequisicaoStatusMaps
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.CodStatusRm)
            .ToListAsync(ct);

        var existingSet = existingCodStatus.ToHashSet();
        var now = DateTimeOffset.UtcNow;

        foreach (var seed in Defaults)
        {
            if (existingSet.Contains(seed.CodStatusRm))
                continue;

            db.RmRequisicaoStatusMaps.Add(new RmRequisicaoStatusMap
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CodStatusRm = seed.CodStatusRm,
                PortalStatusKey = seed.PortalStatus.ToString(),
                Priority = null,
                CreatedAtUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
