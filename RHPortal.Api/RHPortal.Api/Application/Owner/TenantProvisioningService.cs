using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Data.Seeders;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Owner;

public sealed class TenantProvisioningService : ITenantProvisioningService
{
    private readonly MasterDbContext _masterDb;
    private readonly IConfiguration _configuration;
    private readonly ITenantContext _tenantContext;
    private readonly IServiceProvider _scope;

    public TenantProvisioningService(
        MasterDbContext masterDb,
        IConfiguration configuration,
        ITenantContext tenantContext,
        IServiceProvider scope)
    {
        _masterDb = masterDb;
        _configuration = configuration;
        _tenantContext = tenantContext;
        _scope = scope;
    }

    public async Task ProvisionTenantAsync(string tenantId, string name, bool seedAfterCreate = false, Guid? createdByOwnerId = null, CancellationToken ct = default)
    {
        await TenantSeeder.EnsureAsync(_masterDb, tenantId, name, createdByOwnerId, ct);
        await TenantDatabaseEnsurer.EnsureTenantDatabaseExistsAsync(_configuration, tenantId, ct);
        _tenantContext.SetTenantId(tenantId);
        var db = _scope.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync(ct);
        await ApplyOrphanMigrationsAsync(db, tenantId, ct);
        if (seedAfterCreate)
            await RunSeedAsync(tenantId, db, ct);
    }

    /// <summary>
    /// Applies 10 orphan EF Core migrations that have no .Designer.cs companion file
    /// and are therefore invisible to MigrateAsync(). Each statement is idempotent.
    /// After running the DDL, each migration is registered in __EFMigrationsHistory
    /// so that a future fix (adding proper .Designer.cs files) won't double-apply them.
    /// </summary>
    public static async Task ApplyOrphanMigrationsAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        // ── 1. AddTenantNotifications ─────────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Notifications" (
                "Id"            uuid                        NOT NULL,
                "TenantId"      character varying(64)       NOT NULL,
                "Title"         character varying(200)      NOT NULL,
                "Message"       character varying(2000)     NOT NULL,
                "Level"         character varying(20)       NOT NULL,
                "Url"           character varying(500)      NULL,
                "IsRead"        boolean                     NOT NULL,
                "CreatedAtUtc"  timestamp with time zone    NOT NULL,
                "UpdatedAtUtc"  timestamp with time zone    NOT NULL,
                CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_Notifications_TenantId_CreatedAtUtc"
                ON "Notifications" ("TenantId", "CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_Notifications_TenantId_IsRead"
                ON "Notifications" ("TenantId", "IsRead");
            """, ct);

        // ── 2. AddNotificationReceipts ────────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "NotificationReceipts" (
                "Id"             uuid                     NOT NULL,
                "TenantId"       character varying(64)    NOT NULL,
                "NotificationId" uuid                     NOT NULL,
                "UserId"         uuid                     NOT NULL,
                "SeenAtUtc"      timestamp with time zone NULL,
                "ReadAtUtc"      timestamp with time zone NULL,
                "CreatedAtUtc"   timestamp with time zone NOT NULL,
                "UpdatedAtUtc"   timestamp with time zone NOT NULL,
                CONSTRAINT "PK_NotificationReceipts" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_NotificationReceipts_TenantId_NotificationId"
                ON "NotificationReceipts" ("TenantId", "NotificationId");
            CREATE INDEX IF NOT EXISTS "IX_NotificationReceipts_TenantId_UserId"
                ON "NotificationReceipts" ("TenantId", "UserId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_NotificationReceipts_TenantId_NotificationId_UserId"
                ON "NotificationReceipts" ("TenantId", "NotificationId", "UserId");
            """, ct);

        // ── 3. AddVagaSlaFields ───────────────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "DataAbertura"                  timestamp with time zone NULL;
            ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "SlaDiasMetaFechamento"         integer NULL;
            ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "RecrutadorResponsavelUserId"   uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_Vagas_RecrutadorResponsavelUserId"
                ON "Vagas" ("RecrutadorResponsavelUserId");
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_Vagas_Users_RecrutadorResponsavelUserId'
                ) THEN
                    ALTER TABLE "Vagas"
                        ADD CONSTRAINT "FK_Vagas_Users_RecrutadorResponsavelUserId"
                        FOREIGN KEY ("RecrutadorResponsavelUserId")
                        REFERENCES "Users" ("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """, ct);

        // ── 4. AddCandidatoVagaMatchingScore ──────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "CandidatoVagaMatchingScores" (
                "CandidatoId"      uuid                     NOT NULL,
                "VagaId"           uuid                     NOT NULL,
                "Score"            integer                  NOT NULL,
                "CalculatedAtUtc"  timestamp with time zone NOT NULL,
                "TenantId"         character varying(64)    NOT NULL,
                CONSTRAINT "PK_CandidatoVagaMatchingScores" PRIMARY KEY ("CandidatoId", "VagaId"),
                CONSTRAINT "FK_CandidatoVagaMatchingScores_Candidatos_CandidatoId"
                    FOREIGN KEY ("CandidatoId") REFERENCES "Candidatos" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_CandidatoVagaMatchingScores_Vagas_VagaId"
                    FOREIGN KEY ("VagaId") REFERENCES "Vagas" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_CandidatoVagaMatchingScores_VagaId_Score"
                ON "CandidatoVagaMatchingScores" ("VagaId", "Score");
            """, ct);

        // ── 5. VagaDepartmentIdOptional ───────────────────────────────────────
        // ALTER COLUMN ... DROP NOT NULL is a no-op if the column is already nullable.
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Vagas" ALTER COLUMN "DepartmentId" DROP NOT NULL;
            """, ct);

        // ── 6. BackfillCandidatosTenantId ─────────────────────────────────────
        // For a freshly provisioned DB the tables are empty, so this is a no-op.
        await db.Database.ExecuteSqlRawAsync($"""
            UPDATE "Candidatos"             SET "TenantId" = '{tenantId}' WHERE "TenantId" IS NULL OR TRIM("TenantId") = '';
            UPDATE "CandidatoDocumentos"    SET "TenantId" = '{tenantId}' WHERE "TenantId" IS NULL OR TRIM("TenantId") = '';
            UPDATE "CandidatoStatusHistories" SET "TenantId" = '{tenantId}' WHERE "TenantId" IS NULL OR TRIM("TenantId") = '';
            """, ct);

        // ── 7. AddGamificationDailyStateAndIdempotency ────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "GamificationDailyStates" (
                "Id"                         uuid                     NOT NULL,
                "TenantId"                   character varying(64)    NOT NULL,
                "UserId"                     uuid                     NOT NULL,
                "CurrentStreak"              integer                  NOT NULL,
                "BestStreak"                 integer                  NOT NULL,
                "LastCheckInDate"            date                     NULL,
                "LastActivityDate"           date                     NULL,
                "FeedbackSentToday"          integer                  NOT NULL,
                "CelebrationPostsToday"      integer                  NOT NULL,
                "CelebrationCommentsToday"   integer                  NOT NULL,
                "OneOnOneCompletedToday"     integer                  NOT NULL,
                "DevelopmentPlansCreatedToday" integer                NOT NULL,
                "SurveyAnsweredToday"        integer                  NOT NULL,
                "CreatedAtUtc"               timestamp with time zone NOT NULL,
                "UpdatedAtUtc"               timestamp with time zone NOT NULL,
                CONSTRAINT "PK_GamificationDailyStates" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_GamificationDailyStates_Users_UserId"
                    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
            );
            CREATE INDEX IF NOT EXISTS "IX_GamificationDailyStates_TenantId_LastCheckInDate"
                ON "GamificationDailyStates" ("TenantId", "LastCheckInDate");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_GamificationDailyStates_TenantId_UserId"
                ON "GamificationDailyStates" ("TenantId", "UserId");
            CREATE INDEX IF NOT EXISTS "IX_GamificationDailyStates_UserId"
                ON "GamificationDailyStates" ("UserId");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_RenderCoinTransactions_TenantId_UserId_SourceType_SourceId"
                ON "RenderCoinTransactions" ("TenantId", "UserId", "SourceType", "SourceId")
                WHERE "SourceType" IS NOT NULL AND "SourceId" IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_SurveyResponses_TenantId_SurveyId_UserId"
                ON "SurveyResponses" ("TenantId", "SurveyId", "UserId");
            """, ct);

        // ── 8. AddCandidatoPretensaoSalarialELinkedin ─────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'Candidatos' AND column_name = 'PretensaoSalarial'
                ) THEN
                    ALTER TABLE "Candidatos" ADD "PretensaoSalarial" numeric(18,2);
                END IF;
            END $$;
            """, ct);

        // ── 9. AddVagaNomeEngessado ────────────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "NomeEngessado" character varying(200) NULL;
            """, ct);

        // ── 10. AddCamposIntegracaoPreAdmissao ────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'PreAdmissoes' AND column_name = 'IntegracaoResultado') THEN
                    ALTER TABLE "PreAdmissoes" ADD "IntegracaoResultado" smallint;
                END IF;
            END $$;
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'PreAdmissoes' AND column_name = 'IntegracaoMensagem') THEN
                    ALTER TABLE "PreAdmissoes" ADD "IntegracaoMensagem" character varying(2000);
                END IF;
            END $$;
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'PreAdmissoes' AND column_name = 'IntegradaEmUtc') THEN
                    ALTER TABLE "PreAdmissoes" ADD "IntegradaEmUtc" timestamp with time zone;
                END IF;
            END $$;
            """, ct);

        // ── 11. AddEmpresaAndUnitFK ───────────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Empresas" (
                "Id"            uuid                        NOT NULL,
                "TenantId"      character varying(64)       NOT NULL,
                "Code"          character varying(30)       NOT NULL,
                "Description"   character varying(120)      NOT NULL,
                "IsActive"      boolean                     NOT NULL DEFAULT true,
                "CreatedAtUtc"  timestamp with time zone    NOT NULL,
                "UpdatedAtUtc"  timestamp with time zone    NOT NULL,
                CONSTRAINT "PK_Empresas" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Empresas_TenantId_Code"
                ON "Empresas" ("TenantId", "Code");
            ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_Units_EmpresaId"
                ON "Units" ("EmpresaId");
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_Units_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "Units"
                        ADD CONSTRAINT "FK_Units_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId")
                        REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """, ct);

        // ── 12. AddUnitNomPessoaJurid ─────────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "NomAbrevPessoaJurid" character varying(60) NULL;
            ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "NomPessoaJurid"      character varying(150) NULL;
            """, ct);

        // ── 13. AddUnitEmpresaCodeUniqueIndex ─────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            DROP INDEX IF EXISTS "IX_Units_TenantId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Units_TenantId_EmpresaId_Code"
                ON "Units" ("TenantId", "EmpresaId", "Code")
                WHERE "EmpresaId" IS NOT NULL;
            """, ct);

        // ── 14. AddCentroCustoEmpresaFK ──────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_CentrosCusto_EmpresaId"
                ON "CentrosCusto" ("EmpresaId");
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_CentrosCusto_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "CentrosCusto"
                        ADD CONSTRAINT "FK_CentrosCusto_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId")
                        REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            DROP INDEX IF EXISTS "IX_CentrosCusto_TenantId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CentrosCusto_TenantId_EmpresaId_Code"
                ON "CentrosCusto" ("TenantId", "EmpresaId", "Code")
                WHERE "EmpresaId" IS NOT NULL;
            """, ct);

        // ── 15. AddCentroCustoValidade ────────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "ValidFrom"  date NULL;
            ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "ValidUntil" date NULL;
            """, ct);

        // ── 16. AddCategoriaSalarialEmpresaEstabelecimento ────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "CategoriasSalariais" ADD COLUMN IF NOT EXISTS "EmpresaId"         uuid NULL;
            ALTER TABLE "CategoriasSalariais" ADD COLUMN IF NOT EXISTS "EstabelecimentoId" uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_CategoriasSalariais_EmpresaId"
                ON "CategoriasSalariais" ("EmpresaId");
            CREATE INDEX IF NOT EXISTS "IX_CategoriasSalariais_EstabelecimentoId"
                ON "CategoriasSalariais" ("EstabelecimentoId");
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_CategoriasSalariais_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "CategoriasSalariais"
                        ADD CONSTRAINT "FK_CategoriasSalariais_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId")
                        REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_CategoriasSalariais_Units_EstabelecimentoId'
                ) THEN
                    ALTER TABLE "CategoriasSalariais"
                        ADD CONSTRAINT "FK_CategoriasSalariais_Units_EstabelecimentoId"
                        FOREIGN KEY ("EstabelecimentoId")
                        REFERENCES "Units"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            DROP INDEX IF EXISTS "IX_CategoriasSalariais_TenantId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CategoriasSalariais_TenantId_EmpresaId_EstabelecimentoId_Code"
                ON "CategoriasSalariais" ("TenantId", "EmpresaId", "EstabelecimentoId", "Code")
                WHERE "EmpresaId" IS NOT NULL AND "EstabelecimentoId" IS NOT NULL;
            """, ct);

        // ── 17. AddUnitNomAbrevPessoaFisic ───────────────────────────────────────
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "NomAbrevPessoaFisic" character varying(60) NULL;
            """, ct);

        // ── Register all 17 orphan migrations in __EFMigrationsHistory ─────────
        // product version matches the EF Core version used in this project.
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            SELECT m."MigrationId", '9.0.0'
            FROM (VALUES
                ('20260127101000_AddTenantNotifications'),
                ('20260127112000_AddNotificationReceipts'),
                ('20260129120000_AddVagaSlaFields'),
                ('20260210180000_AddCandidatoVagaMatchingScore'),
                ('20260211000000_VagaDepartmentIdOptional'),
                ('20260211150000_BackfillCandidatosTenantId'),
                ('20260303190000_AddGamificationDailyStateAndIdempotency'),
                ('20260317100000_AddCandidatoPretensaoSalarialELinkedin'),
                ('20260318000000_AddVagaNomeEngessado'),
                ('20260324000000_AddCamposIntegracaoPreAdmissao'),
                ('20260410200000_AddEmpresaAndUnitFK'),
                ('20260411100000_AddUnitNomPessoaJurid'),
                ('20260411110000_AddUnitEmpresaCodeUniqueIndex'),
                ('20260411120000_AddCentroCustoEmpresaFK'),
                ('20260411130000_AddCentroCustoValidade'),
                ('20260411140000_AddCategoriaSalarialEmpresaEstabelecimento'),
                ('20260411150000_AddUnitNomAbrevPessoaFisic')
            ) AS m("MigrationId")
            WHERE NOT EXISTS (
                SELECT 1 FROM "__EFMigrationsHistory" h
                WHERE h."MigrationId" = m."MigrationId"
            );
            """, ct);
    }

    public async Task SeedTenantAsync(string tenantId, CancellationToken ct = default)
    {
        using var scope = _scope.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<ITenantContext>();
        tenantContext.SetTenantId(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var localizer = scope.ServiceProvider.GetRequiredService<IStringLocalizer<SeedMessages>>();
        var adminPassword = _configuration.GetValue<string>("Seed:AdminPassword") ?? "ChangeThisPassword123!";
        var emailDomain = "dev.local";
        await AdminAccessSeeder.EnsureAsync(db, userManager, roleManager, tenantId, emailDomain, adminPassword, 0, localizer, ct, null);
        await AreaDepartmentSeeder.EnsureAsync(db, emailDomain, ct);
        await AgendaTypeSeeder.EnsureDefaultAsync(db, localizer, ct);
        await UnitSeeder.EnsureAsync(db, ct);
        await JobPositionSeeder.EnsureAsync(db, localizer, ct);
    }

    private async Task RunSeedAsync(string tenantId, AppDbContext db, CancellationToken ct)
    {
        var userManager = _scope.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = _scope.GetRequiredService<RoleManager<ApplicationRole>>();
        var localizer = _scope.GetRequiredService<IStringLocalizer<SeedMessages>>();
        var adminPassword = _configuration.GetValue<string>("Seed:AdminPassword") ?? "ChangeThisPassword123!";
        var emailDomain = "dev.local";
        await AdminAccessSeeder.EnsureAsync(db, userManager, roleManager, tenantId, emailDomain, adminPassword, 0, localizer, ct, null);
        await AreaDepartmentSeeder.EnsureAsync(db, emailDomain, ct);
        await AgendaTypeSeeder.EnsureDefaultAsync(db, localizer, ct);
        await UnitSeeder.EnsureAsync(db, ct);
        await JobPositionSeeder.EnsureAsync(db, localizer, ct);
    }
}
