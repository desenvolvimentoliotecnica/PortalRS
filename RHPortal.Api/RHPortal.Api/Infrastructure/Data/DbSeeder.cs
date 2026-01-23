using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;
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
        var localizer = scope.ServiceProvider.GetRequiredService<IStringLocalizer<SeedMessages>>();
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
            throw new InvalidOperationException(localizer["SeedErrors.AdminPasswordRequired"]);
        var vagaSeedCount = Math.Max(0, config.GetValue<int?>("Seed:Vagas:Count") ?? 50);
        var candidatoSeedCount = Math.Max(0, config.GetValue<int?>("Seed:Candidatos:Count") ?? 50);
        var candidatoSeedPerVaga = Math.Max(0, config.GetValue<int?>("Seed:Candidatos:PerVaga") ?? 0);
        var vagaPatternsFile = config.GetValue<string>("Seed:Vagas:PatternsFile");
        var vagaRequirementsFile = config.GetValue<string>("Seed:Vagas:RequirementsFile");
        var randomSeed = config.GetValue<int?>("Seed:RandomSeed");
        var managerSeedCount = Math.Max(0, config.GetValue<int?>("Seed:Managers:Count") ?? 10);
        var agendaEventSeedCount = Math.Max(0, config.GetValue<int?>("Seed:AgendaEvents:Count") ?? 10);
        var emailMessageSeedCount = Math.Max(0, config.GetValue<int?>("Seed:EmailMessages:Count") ?? 40);
        var inboxSeedCountDefault = Math.Max(0, config.GetValue<int?>("Seed:InboxItems:Count") ?? 3);
        var seedVagasEnabled = config.GetValue<bool?>("Seed:Vagas:Enabled") ?? true;
        var seedCandidatosEnabled = config.GetValue<bool?>("Seed:Candidatos:Enabled") ?? true;
        var seedInboxEnabledDefault = config.GetValue<bool?>("Seed:InboxItems:Enabled") ?? true;

        int resolveInboxCount(string tenantId)
            => Math.Max(0, config.GetValue<int?>($"Seed:Tenants:{tenantId}:InboxItems:Count") ?? inboxSeedCountDefault);

        bool resolveInboxEnabled(string tenantId)
            => config.GetValue<bool?>($"Seed:Tenants:{tenantId}:InboxItems:Enabled") ?? seedInboxEnabledDefault;

        var liotecnicaInboxCount = resolveInboxCount("liotecnica");
        var liotecnicaInboxEnabled = resolveInboxEnabled("liotecnica");
        await SeedTenantAsync(db, tenantContext, userManager, roleManager, "liotecnica", "Liotecnica", adminPassword, managerSeedCount, agendaEventSeedCount, emailMessageSeedCount, vagaSeedCount, candidatoSeedCount, candidatoSeedPerVaga, vagaPatternsFile, vagaRequirementsFile, liotecnicaInboxCount, seedVagasEnabled, seedCandidatosEnabled, liotecnicaInboxEnabled, localizer, randomSeed, ct);
        var devInboxCount = resolveInboxCount("dev");
        var devInboxEnabled = resolveInboxEnabled("dev");
        await SeedTenantAsync(db, tenantContext, userManager, roleManager, "dev", "Development", adminPassword, managerSeedCount, agendaEventSeedCount, emailMessageSeedCount, vagaSeedCount, candidatoSeedCount, candidatoSeedPerVaga, vagaPatternsFile, vagaRequirementsFile, devInboxCount, seedVagasEnabled, seedCandidatosEnabled, devInboxEnabled, localizer, randomSeed, ct);
    }

    private static async Task SeedTenantAsync(
        AppDbContext db,
        ITenantContext tenantContext,
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        string tenantId,
        string tenantName,
        string adminPassword,
        int managerSeedCount,
        int agendaEventSeedCount,
        int emailMessageSeedCount,
        int vagaSeedCount,
        int candidatoSeedCount,
        int candidatoSeedPerVaga,
        string? vagaPatternsFile,
        string? vagaRequirementsFile,
        int inboxSeedCount,
        bool seedVagasEnabled,
        bool seedCandidatosEnabled,
        bool seedInboxEnabled,
        IStringLocalizer<SeedMessages> localizer,
        int? randomSeed,
        CancellationToken ct)
    {
        await global::RhPortal.Api.Infrastructure.Data.Seeders.TenantSeeder.EnsureAsync(db, tenantId, tenantName, ct);
        tenantContext.SetTenantId(tenantId);

        var emailDomain = tenantId.Equals("liotecnica", StringComparison.OrdinalIgnoreCase)
            ? "liotecnica.com.br"
            : "dev.local";

        await global::RhPortal.Api.Infrastructure.Data.Seeders.AdminAccessSeeder.EnsureAsync(db, userManager, roleManager, tenantId, emailDomain, adminPassword, emailMessageSeedCount, ct, randomSeed);

        // Areas, departamentos, requisitos e centros de custo
        await global::RhPortal.Api.Infrastructure.Data.Seeders.AreaDepartmentSeeder.EnsureAsync(db, emailDomain, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.AgendaTypeSeeder.EnsureDefaultAsync(db, ct);
        await global::RhPortal.Api.Infrastructure.Data.Seeders.AgendaEventSeeder.EnsureEventsAsync(db, tenantId, agendaEventSeedCount, ct, randomSeed);
        await global::RhPortal.Api.Infrastructure.Data.Seeders.UnitSeeder.EnsureAsync(db, ct);

        // Seed de Cargos (JobPositions)
        await global::RhPortal.Api.Infrastructure.Data.Seeders.JobPositionSeeder.EnsureAsync(db, localizer, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.ManagerSeeder.EnsureAsync(db, managerSeedCount, ct, randomSeed);

        if (seedVagasEnabled)
            await global::RhPortal.Api.Infrastructure.Data.Seeders.VagaSeeder.EnsureAsync(db, tenantId, vagaSeedCount, vagaPatternsFile, vagaRequirementsFile, randomSeed, localizer, ct);
        if (seedCandidatosEnabled)
            await global::RhPortal.Api.Infrastructure.Data.Seeders.CandidatoSeeder.EnsureAsync(db, tenantId, emailDomain, candidatoSeedCount, candidatoSeedPerVaga, randomSeed, ct);
        if (seedInboxEnabled)
            await global::RhPortal.Api.Infrastructure.Data.Seeders.InboxItemSeeder.EnsureAsync(db, tenantId, inboxSeedCount, ct);

    }

}