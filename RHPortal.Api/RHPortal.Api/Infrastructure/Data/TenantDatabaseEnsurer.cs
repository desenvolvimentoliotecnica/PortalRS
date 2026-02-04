using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace RhPortal.Api.Infrastructure.Data;

public static class TenantDatabaseEnsurer
{
    /// <summary>
    /// Ensures the database for the given tenant exists (PostgreSQL CREATE DATABASE if not exists).
    /// Uses ConnectionStrings:Master to derive admin connection (connects to "postgres" to create the new DB).
    /// </summary>
    public static async Task EnsureTenantDatabaseExistsAsync(
        IConfiguration configuration,
        string tenantId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(tenantId)
            || string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase)
            || string.Equals(tenantId, "system", StringComparison.OrdinalIgnoreCase))
            return;

        var template = configuration.GetConnectionString("TenantTemplate");
        if (string.IsNullOrWhiteSpace(template))
            return;

        var tenantConn = string.Format(template, tenantId);
        var tenantDbName = new NpgsqlConnectionStringBuilder(tenantConn).Database;
        if (string.IsNullOrWhiteSpace(tenantDbName))
            return;

        var masterConn = configuration.GetConnectionString("Master");
        if (string.IsNullOrWhiteSpace(masterConn))
            return;

        var builder = new NpgsqlConnectionStringBuilder(masterConn);
        builder.Database = "postgres";

        await using var conn = new NpgsqlConnection(builder.ConnectionString);
        await conn.OpenAsync(ct);

        var exists = await DatabaseExistsAsync(conn, tenantDbName, ct);
        if (exists)
            return;

        await using (var cmd = new NpgsqlCommand(
            $"CREATE DATABASE \"{tenantDbName.Replace("\"", "\"\"")}\"", conn))
        {
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    private static async Task<bool> DatabaseExistsAsync(
        NpgsqlConnection conn,
        string databaseName,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "SELECT 1 FROM pg_database WHERE datname = @name", conn);
        cmd.Parameters.AddWithValue("name", databaseName);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is not null;
    }
}
