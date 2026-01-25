using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Ops;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.Data;

public static class DbSeeder
{
    // ✅ Mantém compatibilidade com o que você já chama hoje
    public static Task MigrateAndSeedAsync(
        IServiceProvider services,
        IConfiguration config,
        IHostEnvironment env,
        CancellationToken ct = default)
        => MigrateAndSeedAsync(
            services,
            config,
            env,
            forceResetDatabase: null,
            forceCleanDatabase: null,
            overrides: null,
            progress: null,
            ct);

    /// <summary>
    /// ✅ Modelo recomendado para endpoint:
    /// - forceResetDatabase: true => reseta (mas DbSeeder bloqueia fora de dev)
    /// - overrides: permite forçar seed geral e seeds específicos SEM mexer no appsettings
    ///
    /// Dica: para reset via endpoint, considere chamar com ct: CancellationToken.None,
    /// para evitar cancelamento do client/timeout.
    /// </summary>
    public static async Task MigrateAndSeedAsync(
        IServiceProvider services,
        IConfiguration config,
        IHostEnvironment env,
        bool? forceResetDatabase,
        bool? forceCleanDatabase,
        SeedOverrides? overrides,
        IResetProgressReporter? progress,
        CancellationToken ct = default)
    {
        using var scope = services.CreateScope();

        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var localizer = scope.ServiceProvider.GetRequiredService<IStringLocalizer<SeedMessages>>();
        var resetState = scope.ServiceProvider.GetService<ResetState>();

        resetState?.SetResetting(true);
        async Task ReportAsync(string stage, string message, int? percent = null)
        {
            if (progress is null)
                return;

            await progress.ReportAsync(
                new ResetProgressMessage(stage, message, percent, DateTimeOffset.UtcNow),
                ct);
        }

        try
        {
            await ReportAsync("start", "Iniciando operação...", 0);

            // ---------------------------
            // Reset enable/disable
            // ---------------------------
            var resetDbFromConfig = config.GetValue<bool>("Seed:ResetDatabase");
            var resetDb = forceResetDatabase ?? resetDbFromConfig;
            var cleanDb = forceCleanDatabase ?? false;

            // MUITO IMPORTANTE: proteja para não apagar em produção
            if (!env.IsDevelopment())
            {
                resetDb = false;
                cleanDb = false;
            }

            if (resetDb)
            {
                await ReportAsync("reset", "Resetando schema do banco...", 10);
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
            else if (cleanDb)
            {
                await ReportAsync("clean", "Limpando dados do banco...", 10);
                await ClearAllDataAsync(db, ct);
            }

            await ReportAsync("migrate", "Aplicando migrations...", 25);
            // ✅ Migrar sempre depois do reset
            await db.Database.MigrateAsync(ct);

            await ReportAsync("seed-core", "Aplicando seeds essenciais...", 35);
            // ✅ Seeds essenciais sempre (mesmo com Seed:Enabled=false)
            await global::RhPortal.Api.Infrastructure.Data.Seeders.MenuRoleSeeder
                .EnsureDefaultMenusAsync(db, tenantContext, roleManager, localizer, ct);

            // ---------------------------
            // Seed geral enable/disable
            // ---------------------------
            var seedEnabledFromConfig = config.GetValue<bool?>("Seed:Enabled") ?? true;
            var seedEnabled = overrides?.SeedEnabled ?? seedEnabledFromConfig;

            if (!seedEnabled)
            {
                await ReportAsync("done", "Concluído (seed desativado).", 100);
                return;
            }

            // ---------------------------
            // Carrega configs padrão
            // ---------------------------
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

            // ---------------------------
            // Flags específicos (config OU override)
            // ---------------------------
            var seedVagasEnabledFromConfig = config.GetValue<bool?>("Seed:Vagas:Enabled") ?? true;
            var seedCandidatosEnabledFromConfig = config.GetValue<bool?>("Seed:Candidatos:Enabled") ?? true;
            var seedInboxEnabledDefaultFromConfig = config.GetValue<bool?>("Seed:InboxItems:Enabled") ?? true;

            var seedVagasEnabled = overrides?.SeedVagasEnabled ?? seedVagasEnabledFromConfig;
            var seedCandidatosEnabled = overrides?.SeedCandidatosEnabled ?? seedCandidatosEnabledFromConfig;
            var seedInboxEnabledDefault = overrides?.SeedInboxEnabled ?? seedInboxEnabledDefaultFromConfig;

            // ---------------------------
            // Tenants (com override também)
            // ---------------------------
            int resolveInboxCount(string tenantId)
                => Math.Max(0, config.GetValue<int?>($"Seed:Tenants:{tenantId}:InboxItems:Count") ?? inboxSeedCountDefault);

            bool resolveInboxEnabled(string tenantId)
            {
                // Se override global de inbox foi fornecido, ele manda.
                if (overrides?.SeedInboxEnabled is bool forced)
                    return forced;

                return config.GetValue<bool?>($"Seed:Tenants:{tenantId}:InboxItems:Enabled") ?? seedInboxEnabledDefault;
            }

            // ✅ Tenant 1
            var liotecnicaInboxCount = resolveInboxCount("liotecnica");
            var liotecnicaInboxEnabled = resolveInboxEnabled("liotecnica");

            await ReportAsync("seed-tenant", "Seeding tenant Liotecnica...", 55);
            await SeedTenantAsync(
                db, tenantContext, userManager, roleManager,
                tenantId: "liotecnica",
                tenantName: "Liotecnica",
                adminPassword: adminPassword,
                managerSeedCount: managerSeedCount,
                agendaEventSeedCount: agendaEventSeedCount,
                emailMessageSeedCount: emailMessageSeedCount,
                vagaSeedCount: vagaSeedCount,
                candidatoSeedCount: candidatoSeedCount,
                candidatoSeedPerVaga: candidatoSeedPerVaga,
                vagaPatternsFile: vagaPatternsFile,
                vagaRequirementsFile: vagaRequirementsFile,
                inboxSeedCount: liotecnicaInboxCount,
                seedVagasEnabled: seedVagasEnabled,
                seedCandidatosEnabled: seedCandidatosEnabled,
                seedInboxEnabled: liotecnicaInboxEnabled,
                localizer: localizer,
                randomSeed: randomSeed,
                ct: ct);

            // ✅ Tenant 2
            var devInboxCount = resolveInboxCount("dev");
            var devInboxEnabled = resolveInboxEnabled("dev");

            await ReportAsync("seed-tenant", "Seeding tenant Development...", 80);
            await SeedTenantAsync(
                db, tenantContext, userManager, roleManager,
                tenantId: "dev",
                tenantName: "Development",
                adminPassword: adminPassword,
                managerSeedCount: managerSeedCount,
                agendaEventSeedCount: agendaEventSeedCount,
                emailMessageSeedCount: emailMessageSeedCount,
                vagaSeedCount: vagaSeedCount,
                candidatoSeedCount: candidatoSeedCount,
                candidatoSeedPerVaga: candidatoSeedPerVaga,
                vagaPatternsFile: vagaPatternsFile,
                vagaRequirementsFile: vagaRequirementsFile,
                inboxSeedCount: devInboxCount,
                seedVagasEnabled: seedVagasEnabled,
                seedCandidatosEnabled: seedCandidatosEnabled,
                seedInboxEnabled: devInboxEnabled,
                localizer: localizer,
                randomSeed: randomSeed,
                ct: ct);

            await ReportAsync("done", "Concluído.", 100);
        }
        finally
        {
            resetState?.SetResetting(false);
        }
    }

    private static async Task ClearAllDataAsync(AppDbContext db, CancellationToken ct)
    {
        if (!string.Equals(db.Database.ProviderName, "Npgsql.EntityFrameworkCore.PostgreSQL", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Clean database is only supported for PostgreSQL.");

        const string sql = """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '__EFMigrationsHistory')
            LOOP
                EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
            END LOOP;
        END $$;
        """;

        await db.Database.ExecuteSqlRawAsync(sql, ct);
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
        await global::RhPortal.Api.Infrastructure.Data.Seeders.TenantSeeder
            .EnsureAsync(db, tenantId, tenantName, ct);

        tenantContext.SetTenantId(tenantId);

        var emailDomain = tenantId.Equals("liotecnica", StringComparison.OrdinalIgnoreCase)
            ? "liotecnica.com.br"
            : "dev.local";

        await global::RhPortal.Api.Infrastructure.Data.Seeders.AdminAccessSeeder.EnsureAsync(
            db,
            userManager,
            roleManager,
            tenantId,
            emailDomain,
            adminPassword,
            emailMessageSeedCount,
            localizer,
            ct,
            randomSeed);

        // Areas, departamentos, requisitos e centros de custo
        await global::RhPortal.Api.Infrastructure.Data.Seeders.AreaDepartmentSeeder
            .EnsureAsync(db, emailDomain, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.AgendaTypeSeeder
            .EnsureDefaultAsync(db, localizer, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.AgendaEventSeeder
            .EnsureEventsAsync(db, tenantId, agendaEventSeedCount, ct, randomSeed);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.UnitSeeder
            .EnsureAsync(db, ct);

        // Seed de Cargos (JobPositions)
        await global::RhPortal.Api.Infrastructure.Data.Seeders.JobPositionSeeder
            .EnsureAsync(db, localizer, ct);

        await global::RhPortal.Api.Infrastructure.Data.Seeders.ManagerSeeder
            .EnsureAsync(db, managerSeedCount, ct, randomSeed);

        if (seedVagasEnabled)
        {
            await global::RhPortal.Api.Infrastructure.Data.Seeders.VagaSeeder.EnsureAsync(
                db, tenantId, vagaSeedCount, vagaPatternsFile, vagaRequirementsFile, randomSeed, localizer, ct);
        }

        if (seedCandidatosEnabled)
        {
            await global::RhPortal.Api.Infrastructure.Data.Seeders.CandidatoSeeder.EnsureAsync(
                db, tenantId, emailDomain, candidatoSeedCount, candidatoSeedPerVaga, randomSeed, ct);
        }

        if (seedInboxEnabled)
        {
            await global::RhPortal.Api.Infrastructure.Data.Seeders.InboxItemSeeder.EnsureAsync(
                db, tenantId, inboxSeedCount, ct);
        }
    }

    /// <summary>
    /// Overrides finos para endpoint (sem mexer no appsettings).
    /// - null => usa o appsettings
    /// - true/false => força comportamento
    /// </summary>
    public sealed record SeedOverrides(
        bool? SeedEnabled = null,
        bool? SeedVagasEnabled = null,
        bool? SeedCandidatosEnabled = null,
        bool? SeedInboxEnabled = null
    );
}
