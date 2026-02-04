namespace RhPortal.Api.Application.Owner;

public interface ITenantProvisioningService
{
    /// <summary>
    /// Creates a new tenant: inserts in master, creates the tenant database, applies migrations, and optionally seeds.
    /// </summary>
    Task ProvisionTenantAsync(string tenantId, string name, bool seedAfterCreate = false, Guid? createdByOwnerId = null, CancellationToken ct = default);

    /// <summary>
    /// Runs the seed (admin user, roles, areas, etc.) for an existing tenant. Idempotent.
    /// </summary>
    Task SeedTenantAsync(string tenantId, CancellationToken ct = default);
}
