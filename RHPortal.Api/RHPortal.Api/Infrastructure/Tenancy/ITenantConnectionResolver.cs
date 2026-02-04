namespace RhPortal.Api.Infrastructure.Tenancy;

/// <summary>
/// Resolves the connection string for the current tenant's database.
/// When multi-DB is enabled (Database:Environment + TenantTemplate), returns connection for dev_render_{tenantId}.
/// Otherwise falls back to ConnectionStrings:Default.
/// </summary>
public interface ITenantConnectionResolver
{
    string GetConnectionString();
}
