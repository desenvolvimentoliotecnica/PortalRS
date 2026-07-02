using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Geocoding;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Geocodifica empresas ativas com CEP/cidade mas sem coordenadas — idempotente a cada startup/deploy.
/// Complementa importação RM e corrige registros históricos (ex.: logradouro abreviado do GFILIAL).
/// </summary>
public static class EmpresaGeocodificacaoBackfillSeeder
{
    public const int DefaultMaxPerRun = 50;

    public static async Task EnsureAsync(
        AppDbContext db,
        string tenantId,
        EmpresaGeocodificacaoService geocoding,
        ILogger logger,
        CancellationToken ct,
        int maxPerRun = DefaultMaxPerRun)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return;

        var pendentes = await db.Empresas
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(e =>
                e.TenantId == tenantId &&
                e.IsActive &&
                e.Latitude == null &&
                (e.Cidade != null || e.Cep != null), ct);

        if (pendentes == 0)
            return;

        logger.LogInformation(
            "Backfill geocodificação empresas tenant={TenantId}: {Pendentes} pendente(s), processando até {Max}",
            tenantId, pendentes, maxPerRun);

        await geocoding.GeocodificarPendentesAsync(db, maxPerRun, ct);
    }
}
