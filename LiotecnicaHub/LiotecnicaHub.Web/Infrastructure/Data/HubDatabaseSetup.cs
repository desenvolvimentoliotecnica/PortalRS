using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Infrastructure.Data;

public static class HubDatabaseSetup
{
    public static bool IsSqliteConnectionString(string connectionString) =>
        connectionString.Contains("Data Source=", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("Filename=", StringComparison.OrdinalIgnoreCase);

    public static void ConfigureDbContext(DbContextOptionsBuilder options, string connectionString)
    {
        if (IsSqliteConnectionString(connectionString))
            options.UseSqlite(connectionString);
        else
            options.UseNpgsql(connectionString);
    }

    public static bool IsSqlite(this HubDbContext db) =>
        db.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;

    public static async Task InitializeSchemaAsync(this HubDbContext db, CancellationToken ct = default)
    {
        if (db.IsSqlite())
            await db.Database.EnsureCreatedAsync(ct);
        else
            await db.Database.MigrateAsync(ct);
    }
}
