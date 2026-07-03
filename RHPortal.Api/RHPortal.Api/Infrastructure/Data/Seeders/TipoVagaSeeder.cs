using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante os tipos de vaga padrão do RH (SLA em dias úteis + permanência turnover).
/// Idempotente por código — não sobrescreve tipos já cadastrados pelo tenant.
/// </summary>
public static class TipoVagaSeeder
{
    private sealed record Seed(
        string Code,
        string Name,
        int SlaDiasUteis,
        int? PermanenciaDias,
        int? PermanenciaMeses,
        bool PermanenciaNaoAplica);

    private static readonly Seed[] Seeds =
    [
        new("ADM_TEC", "ADM e Técnicos", 30, 180, null, false),
        new("COMERCIAL", "Comercial", 45, 180, null, false),
        new("ESPECIALISTAS", "Especialistas", 48, 180, null, false),
        new("LIDERANCA", "Liderança", 45, null, 12, false),
        new("OPERACIONAL", "Operacional", 15, null, null, true),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("TipoVagaSeeder requer um tenantId.");

        var existing = await db.EixosVaga
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.Code)
            .ToListAsync(ct);

        var existingSet = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var seed in Seeds)
        {
            if (existingSet.Contains(seed.Code))
                continue;

            db.EixosVaga.Add(new EixoVaga
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = seed.Code,
                Name = seed.Name,
                Description = "Tipo de vaga padrão (seed).",
                SlaDiasMetaFechamento = seed.SlaDiasUteis,
                PermanenciaTurnoverDias = seed.PermanenciaDias,
                PermanenciaTurnoverMeses = seed.PermanenciaMeses,
                PermanenciaNaoAplica = seed.PermanenciaNaoAplica,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
