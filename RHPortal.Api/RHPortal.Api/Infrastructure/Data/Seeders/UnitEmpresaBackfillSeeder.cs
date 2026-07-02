using Microsoft.EntityFrameworkCore;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Preenche <c>Units.EmpresaId</c> em estabelecimentos importados do RM sem vínculo com Empresa.
/// Idempotente — roda a cada startup/deploy e só altera linhas com <c>EmpresaId</c> nulo.
/// </summary>
public static class UnitEmpresaBackfillSeeder
{
    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return;

        var empresas = await db.Empresas
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId)
            .Select(e => new { e.Id, e.Code })
            .ToListAsync(ct);

        if (empresas.Count == 0)
            return;

        var empresaLookup = BuildEmpresaLookup(empresas.Select(e => (e.Code, e.Id)));

        var units = await db.Units
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.EmpresaId == null)
            .ToListAsync(ct);

        if (units.Count == 0)
            return;

        var now = DateTimeOffset.UtcNow;
        var updated = 0;

        foreach (var unit in units)
        {
            var empresaId = ResolveEmpresaId(empresaLookup, unit.Code, codColigada: null);
            if (!empresaId.HasValue)
                continue;

            unit.EmpresaId = empresaId;
            unit.UpdatedAtUtc = now;
            updated++;
        }

        if (updated > 0)
            await db.SaveChangesAsync(ct);
    }

    private static Dictionary<string, Guid> BuildEmpresaLookup(IEnumerable<(string Code, Guid Id)> empresas)
    {
        var lookup = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var (code, id) in empresas)
        {
            foreach (var variant in BuildCodeCandidates(code))
            {
                if (!lookup.ContainsKey(variant))
                    lookup[variant] = id;
            }
        }

        return lookup;
    }

    private static Guid? ResolveEmpresaId(Dictionary<string, Guid> lookup, string? codFilial, int? codColigada)
    {
        foreach (var code in BuildEmpresaCodeCandidates(codFilial, codColigada))
        {
            if (lookup.TryGetValue(code, out var id))
                return id;
        }

        return null;
    }

    private static IEnumerable<string> BuildEmpresaCodeCandidates(string? codFilial, int? codColigada)
    {
        foreach (var code in BuildCodeCandidates(codFilial))
            yield return code;

        if (codColigada.HasValue)
        {
            foreach (var code in BuildCodeCandidates(codColigada.Value.ToString()))
                yield return code;
        }
    }

    private static IEnumerable<string> BuildCodeCandidates(string? rawCode)
    {
        var value = rawCode?.Trim();
        if (string.IsNullOrWhiteSpace(value))
            yield break;

        yield return value;

        if (int.TryParse(value, out var numeric))
        {
            yield return numeric.ToString();
            yield return numeric.ToString().PadLeft(2, '0');
        }
    }
}
