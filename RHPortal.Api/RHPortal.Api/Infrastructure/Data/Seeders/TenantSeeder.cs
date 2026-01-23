using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class TenantSeeder
{
    public static async Task EnsureAsync(
        AppDbContext db,
        string tenantId,
        string tenantName,
        CancellationToken ct)
    {
        var existing = await db.Tenants.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (existing is null)
        {
            db.Tenants.Add(new Tenant
            {
                TenantId = tenantId,
                Name = tenantName,
                IsActive = true
            });
            await db.SaveChangesAsync(ct);
            return;
        }

        if (!string.Equals(existing.Name, tenantName, StringComparison.OrdinalIgnoreCase))
        {
            existing.Name = tenantName;
            await db.SaveChangesAsync(ct);
        }
    }
}
