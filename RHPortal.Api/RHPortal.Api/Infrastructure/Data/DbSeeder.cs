using System.Globalization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Owner;
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
        var masterDb = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
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

        var tenantTemplate = config.GetConnectionString("TenantTemplate");
        var useMultiDb = !string.IsNullOrWhiteSpace(tenantTemplate);

        try
        {
            await ReportAsync("start", "Iniciando operação...", 0);

            // ---------------------------
            // 1. Migrate master DB
            // ---------------------------
            await ReportAsync("migrate-master", "Aplicando migrations no banco master...", 15);
            await masterDb.Database.MigrateAsync(ct);

            // ---------------------------
            // 1b. Migrate Default DB (owner/system) so RequestLogs/LogEntries exist when using dev_render for owner context
            // ---------------------------
            await ReportAsync("migrate-default", "Aplicando migrations AppDbContext no banco default (owner/system)...", 16);
            using (var defaultScope = services.CreateScope())
            {
                var defaultTenantCtx = defaultScope.ServiceProvider.GetRequiredService<ITenantContext>();
                defaultTenantCtx.SetTenantId("owner");
                var defaultDb = defaultScope.ServiceProvider.GetRequiredService<AppDbContext>();
                await defaultDb.Database.MigrateAsync(ct);
            }

            if (useMultiDb)
            {
                // ---------------------------
                // 2. Seed owner user in master
                // ---------------------------
                var ownerEmail = config.GetValue<string>("Seed:OwnerEmail");
                var ownerPassword = config.GetValue<string>("Seed:OwnerPassword") ?? config.GetValue<string>("Seed:AdminPassword");
                if (!string.IsNullOrWhiteSpace(ownerEmail) && !string.IsNullOrWhiteSpace(ownerPassword))
                {
                    await ReportAsync("seed-owner", "Registrando owner no master...", 22);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.OwnerSeeder
                        .EnsureAsync(masterDb, ownerEmail, ownerPassword, ct);
                }

                await ReportAsync("seed-litellm", "Registrando provider LiteLLM no master...", 23);
                var protector = scope.ServiceProvider.GetRequiredService<RhPortal.Api.Infrastructure.Security.ISecretProtector>();
                await global::RhPortal.Api.Infrastructure.Data.Seeders.LiteLlmAiProviderSeeder
                    .EnsureAsync(masterDb, protector, config, env, ct);

                // ---------------------------
                // 2b. Bootstrap tenants declarados em configuração.
                // Em servidor virgem, isso registra tenants base antes da etapa
                // que aplica migrations/seeds em todos os tenants existentes.
                // ---------------------------
                var bootstrapTenants = GetBootstrapTenants(config);
                if (bootstrapTenants.Count > 0)
                {
                    await ReportAsync("bootstrap-tenants", "Registrando tenants iniciais...", 24);
                    foreach (var bootstrapTenant in bootstrapTenants)
                    {
                        await global::RhPortal.Api.Infrastructure.Data.Seeders.TenantSeeder
                            .EnsureAsync(masterDb, bootstrapTenant.TenantId, bootstrapTenant.Name, createdByOwnerId: null, ct);
                    }
                }

                // ---------------------------
                // 3. Migrar todos os tenants existentes
                // MigrateAsync é idempotente: só aplica migrations PENDENTES.
                // Tenants já atualizados terminam em milissegundos.
                // Novos tenants criados via API também passam por este mesmo fluxo
                // em TenantProvisioningService.ProvisionTenantAsync.
                // ---------------------------
                var tenantIds = await masterDb.Tenants
                    .AsNoTracking()
                    .Select(t => t.TenantId)
                    .ToListAsync(ct);

                var pct = 25;
                var step = tenantIds.Count > 0 ? Math.Max(1, (60 - 25) / tenantIds.Count) : 10;

                foreach (var tenantId in tenantIds)
                {
                    await ReportAsync("migrate-tenant", $"Aplicando migrations no tenant {tenantId}...", pct);

                    // Garante que o banco existe (no-op se já existir)
                    await TenantDatabaseEnsurer.EnsureTenantDatabaseExistsAsync(config, tenantId, ct);

                    // Novo scope para cada tenant — garante connection string correta
                    using var tenantScope = services.CreateScope();
                    var tenantCtx = tenantScope.ServiceProvider.GetRequiredService<ITenantContext>();
                    tenantCtx.SetTenantId(tenantId);
                    var tenantDb = tenantScope.ServiceProvider.GetRequiredService<AppDbContext>();

                    await tenantDb.Database.MigrateAsync(ct);
                    await TenantProvisioningService.ApplyOrphanMigrationsAsync(tenantDb, tenantId, ct);

                    var tenantRoleManager = tenantScope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
                    var tenantLocalizer = tenantScope.ServiceProvider.GetRequiredService<IStringLocalizer<SeedMessages>>();
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.MenuRoleSeeder
                        .EnsureRolesExistAsync(tenantRoleManager, tenantLocalizer, ct);
                    var tenantAdminRole = await tenantRoleManager.Roles.FirstOrDefaultAsync(x => x.Name == "Admin", ct);
                    if (tenantAdminRole is not null)
                    {
                        await global::RhPortal.Api.Infrastructure.Data.Seeders.MenuSeeder
                            .EnsureAsync(tenantDb, tenantAdminRole, tenantLocalizer, ct);
                        await global::RhPortal.Api.Infrastructure.Data.Seeders.MenuRoleSeeder
                            .EnsureDefaultRoleMenuAccessAsync(tenantDb, ct);
                    }

                    // Seeds idempotentes de tabelas parametrizáveis (rodam a cada startup — no-op se já populadas).
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.MotivoRequisicaoVagaSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.TipoVagaSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.UnitEmpresaBackfillSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);
                    var empresaGeocoding = tenantScope.ServiceProvider.GetRequiredService<RhPortal.Api.Application.Geocoding.EmpresaGeocodificacaoService>();
                    var tenantLogger = tenantScope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("EmpresaGeocodificacaoBackfill");
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.EmpresaGeocodificacaoBackfillSeeder
                        .EnsureAsync(tenantDb, tenantId, empresaGeocoding, tenantLogger, ct);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.TenantRmIntegrationDefaultsSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.TenantAiDefaultsSeeder
                        .EnsureAsync(tenantDb, masterDb, tenantId, env, ct);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.RmRequisicaoStatusMapSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.DocumentacaoPadraoConfigSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.ApiKeySeeder
                        .EnsureAsync(tenantDb, config, tenantId, ct);

                    // Templates de avaliação prontos (Entrega 1.1 — Fase 1 Paridade Feedz).
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.AvaliacaoTemplateSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);

                    // Templates de pauta de 1:1 prontos (Entrega 1.2 — Fase 1 Paridade Feedz).
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.OneOnOneTemplateSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);

                    // Templates de feedback prontos (Entrega 1.3 — Fase 1 Paridade Feedz).
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.FeedbackTemplateSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);

                    // Templates de Survey (eNPS, Clima, Liderança, Diversidade) — Entrega 1.5.
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.SurveyTemplateSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);

                    // Catálogo Render Coins (Entrega 1.8) — 6 recompensas seed.
                    await global::RhPortal.Api.Infrastructure.Data.Seeders.RenderCoinRewardSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);

                    await global::RhPortal.Api.Infrastructure.Data.Seeders.EntrevistaSaidaTemplateSeeder
                        .EnsureAsync(tenantDb, tenantId, ct);

                    // Garante defaults do catálogo de módulos para tenants provisionados antes da
                    // introdução do TenantModules (idempotente).
                    var tenantModuleService = tenantScope.ServiceProvider.GetRequiredService<TenantModuleService>();
                    await tenantModuleService.EnsureDefaultsAsync(tenantId, ct);

                    pct = Math.Min(pct + step, 60);
                }
            }
            else
            {
                // ---------------------------
                // Single-DB: reset enable/disable
                // ---------------------------
                var resetDbFromConfig = config.GetValue<bool>("Seed:ResetDatabase");
                var resetDb = forceResetDatabase ?? resetDbFromConfig;
                var cleanDb = forceCleanDatabase ?? false;

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
                await db.Database.MigrateAsync(ct);
                await TenantProvisioningService.ApplyOrphanMigrationsAsync(db, "dev", ct);
            }

            await ReportAsync("seed-core", "Aplicando seeds essenciais...", 35);
            // ✅ Seeds essenciais sempre (mesmo com Seed:Enabled=false)
            // Garante pt-BR no thread para que IStringLocalizer resolva corretamente
            // (sem HTTP context, CultureInfo padrão seria Invariant e o .resx neutro não existe)
            var previousCulture = CultureInfo.CurrentCulture;
            var previousUiCulture = CultureInfo.CurrentUICulture;
            try
            {
                CultureInfo.CurrentCulture = new CultureInfo("pt-BR");
                CultureInfo.CurrentUICulture = new CultureInfo("pt-BR");
                await global::RhPortal.Api.Infrastructure.Data.Seeders.MenuRoleSeeder
                    .EnsureDefaultMenusAsync(masterDb, scope.ServiceProvider, tenantContext, roleManager, localizer, ct);
            }
            finally
            {
                CultureInfo.CurrentCulture = previousCulture;
                CultureInfo.CurrentUICulture = previousUiCulture;
            }

            await ReportAsync("done", "Concluído.", 100);
        }
        finally
        {
            resetState?.SetResetting(false);
        }
    }

    private static IReadOnlyList<BootstrapTenant> GetBootstrapTenants(IConfiguration config)
    {
        var tenants = new List<BootstrapTenant>();
        foreach (var child in config.GetSection("BootstrapTenants").GetChildren())
        {
            var enabled = child.GetValue("Enabled", true);
            if (!enabled)
                continue;

            var tenantId = child["TenantId"]?.Trim().ToLowerInvariant();
            var name = child["Name"]?.Trim();
            if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(name))
                continue;

            tenants.Add(new BootstrapTenant(tenantId, name));
        }

        return tenants
            .GroupBy(x => x.TenantId, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();
    }

    private sealed record BootstrapTenant(string TenantId, string Name);

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

    /// <summary>
    /// Overrides finos para endpoint (sem mexer no appsettings).
    /// - null => usa o appsettings
    /// - true/false => força comportamento
    /// </summary>
    public sealed record SeedOverrides(
        bool? SeedEnabled = null,
        bool? SeedCandidatosEnabled = null,
        bool? SeedInboxEnabled = null,
        bool? SeedPreAdmisoesEnabled = null
    );
}
