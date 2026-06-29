using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante defaults de integração RM por tenant (flag RequisicoesVagaOrigemRm ativa).
/// Idempotente: roda a cada startup/deploy e mantém a flag ligada.
/// </summary>
public static class TenantRmIntegrationDefaultsSeeder
{
    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("TenantRmIntegrationDefaultsSeeder requer um tenantId.");

        var now = DateTimeOffset.UtcNow;
        var changed = false;

        var tenantConfig = await db.TenantConfiguracoes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);

        if (tenantConfig is null)
        {
            db.TenantConfiguracoes.Add(new TenantConfiguracao
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                RequisicoesVagaOrigemRm = true,
                UpdatedAtUtc = now,
            });
            changed = true;
        }
        else if (!tenantConfig.RequisicoesVagaOrigemRm)
        {
            tenantConfig.RequisicoesVagaOrigemRm = true;
            tenantConfig.UpdatedAtUtc = now;
            changed = true;
        }

        var rmConfig = await db.TenantRmConfiguracoes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);

        if (rmConfig is not null && !rmConfig.RequisicoesVagaOrigemRm)
        {
            rmConfig.RequisicoesVagaOrigemRm = true;
            rmConfig.UpdatedAtUtc = now;
            changed = true;
        }

        if (changed)
            await db.SaveChangesAsync(ct);
    }
}
