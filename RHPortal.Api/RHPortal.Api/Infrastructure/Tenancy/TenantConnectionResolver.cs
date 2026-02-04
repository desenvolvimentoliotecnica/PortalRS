using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Infrastructure.Tenancy;

public sealed class TenantConnectionResolver : ITenantConnectionResolver
{
    private readonly ITenantContext _tenantContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TenantConnectionResolver> _logger;

    public TenantConnectionResolver(ITenantContext tenantContext, IConfiguration configuration, ILogger<TenantConnectionResolver> logger)
    {
        _tenantContext = tenantContext;
        _configuration = configuration;
        _logger = logger;
    }

    public string GetConnectionString()
    {
        var tenantId = _tenantContext.TenantId;
        // "owner" and "system" are not real tenants with their own DB; use Default/Master (dev_render) so everything shared lives in one DB
        if (string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase)
            || string.Equals(tenantId, "system", StringComparison.OrdinalIgnoreCase))
        {
            var fallback = _configuration.GetConnectionString("Default")
                ?? _configuration.GetConnectionString("Master");
            if (string.IsNullOrWhiteSpace(fallback))
                throw new InvalidOperationException("ConnectionStrings:Default or Master is required for owner/system context.");
            var dbName = GetDatabaseNameFromConnectionString(fallback);
            _logger.LogDebug("TenantConnectionResolver: TenantId={TenantId}, Using=Default (owner/system), Database={Database}", tenantId, dbName);
            return fallback;
        }

        var template = _configuration.GetConnectionString("TenantTemplate");
        if (!string.IsNullOrWhiteSpace(template) && !string.IsNullOrWhiteSpace(tenantId))
        {
            var conn = string.Format(template, tenantId);
            var dbName = GetDatabaseNameFromConnectionString(conn);
            _logger.LogDebug("TenantConnectionResolver: TenantId={TenantId}, Using=TenantTemplate, Database={Database}", tenantId, dbName);
            return conn;
        }

        var defaultConn = _configuration.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(defaultConn))
            throw new InvalidOperationException("ConnectionStrings:Default or TenantTemplate with tenant context is required.");
        var defaultDbName = GetDatabaseNameFromConnectionString(defaultConn);
        _logger.LogDebug("TenantConnectionResolver: TenantId={TenantId}, Using=Default (fallback), Database={Database}", tenantId, defaultDbName);
        return defaultConn;
    }

    private static string GetDatabaseNameFromConnectionString(string conn)
    {
        if (string.IsNullOrWhiteSpace(conn)) return "(empty)";
        var idx = conn.IndexOf("Database=", StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return "(unknown)";
        var start = idx + "Database=".Length;
        var end = conn.IndexOf(';', start);
        return end < 0 ? conn[start..].Trim() : conn[start..end].Trim();
    }
}
