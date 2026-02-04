using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class TenantSeeder
{
    public static async Task EnsureAsync(
        MasterDbContext masterDb,
        string tenantId,
        string tenantName,
        Guid? createdByOwnerId,
        CancellationToken ct)
    {
        var existing = await masterDb.Tenants.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        var now = DateTimeOffset.UtcNow;
        if (existing is null)
        {
            masterDb.Tenants.Add(new Tenant
            {
                TenantId = tenantId,
                Name = tenantName,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
                CreatedByOwnerId = createdByOwnerId
            });
            await masterDb.SaveChangesAsync(ct);
            return;
        }

        if (!string.Equals(existing.Name, tenantName, StringComparison.OrdinalIgnoreCase))
        {
            existing.Name = tenantName;
            existing.UpdatedAtUtc = now;
            await masterDb.SaveChangesAsync(ct);
        }
    }
}
