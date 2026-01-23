using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task MigrateAndSeedAsync(IServiceProvider services, IConfiguration config, IHostEnvironment env, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

        var seedEnabled = config.GetValue<bool?>("Seed:Enabled") ?? true;
        var resetDb = config.GetValue<bool>("Seed:ResetDatabase");

        // MUITO IMPORTANTE: proteja para não apagar em produção
        if (!env.IsDevelopment())
            resetDb = false;

        if (resetDb)
        {
            if (string.Equals(db.Database.ProviderName, "Npgsql.EntityFrameworkCore.PostgreSQL", StringComparison.OrdinalIgnoreCase))
            {
                await db.Database.ExecuteSqlRawAsync("DROP SCHEMA IF EXISTS public CASCADE;", ct);
                await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA public;", ct);
            }
            else
            {
                await db.Database.EnsureDeletedAsync(ct);
            }
        }

        await db.Database.MigrateAsync(ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.MenuRoleSeeder.EnsureDefaultMenusAsync(db, tenantContext, roleManager, ct);

        if (!seedEnabled)
            return;

        var adminPassword = config.GetValue<string>("Seed:AdminPassword");
        if (string.IsNullOrWhiteSpace(adminPassword))
            throw new InvalidOperationException("Seed:AdminPassword is required.");

        await SeedTenantAsync(db, tenantContext, userManager, roleManager, "liotecnica", "Liotecnica", adminPassword, ct);
        await SeedTenantAsync(db, tenantContext, userManager, roleManager, "dev", "Development", adminPassword, ct);
    }

    private static async Task SeedTenantAsync(
        AppDbContext db,
        ITenantContext tenantContext,
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        string tenantId,
        string tenantName,
        string adminPassword,
        CancellationToken ct)
    {
        await global::RhPortal.Api.Infrastructure.Data.Seeders.TenantSeeder.EnsureAsync(db, tenantId, tenantName, ct);
        tenantContext.SetTenantId(tenantId);

        var emailDomain = tenantId.Equals("liotecnica", StringComparison.OrdinalIgnoreCase)
            ? "liotecnica.com.br"
            : "dev.local";

        await global::RhPortal.Api.Infrastructure.Data.Seeders.AdminAccessSeeder.EnsureAsync(db, userManager, roleManager, tenantId, emailDomain, adminPassword, ct);

        // Areas, departamentos, requisitos e centros de custo
        await global::RhPortal.Api.Infrastructure.Data.Seeders.AreaDepartmentSeeder.EnsureAsync(db, emailDomain, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.AgendaTypeSeeder.EnsureDefaultAsync(db, ct);
        await global::RhPortal.Api.Infrastructure.Data.Seeders.AgendaEventSeeder.EnsureEventsAsync(db, tenantId, ct);
        await global::RhPortal.Api.Infrastructure.Data.Seeders.UnitSeeder.EnsureAsync(db, ct);

        // Seed de Cargos (JobPositions)
        await global::RhPortal.Api.Infrastructure.Data.Seeders.JobPositionSeeder.EnsureAsync(db, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.ManagerSeeder.EnsureAsync(db, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.VagaSeeder.EnsureAsync(db, tenantId, ct);
        await global::RhPortal.Api.Infrastructure.Data.Seeders.CandidatoSeeder.EnsureAsync(db, tenantId, emailDomain, ct);
        await global::RhPortal.Api.Infrastructure.Data.Seeders.InboxItemSeeder.EnsureAsync(db, tenantId, ct);

    }

}