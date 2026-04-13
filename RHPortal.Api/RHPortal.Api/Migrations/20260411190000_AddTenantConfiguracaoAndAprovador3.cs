using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411190000_AddTenantConfiguracaoAndAprovador3")]
public partial class AddTenantConfiguracaoAndAprovador3 : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // ── TenantConfiguracoes: config por empresa ──
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "TenantConfiguracoes" (
                "Id"                        uuid            NOT NULL,
                "TenantId"                  text            NOT NULL,
                "RhDeveAprovarAposGestor"   boolean         NOT NULL DEFAULT false,
                "AprovadorRhId"             uuid            NULL,
                "UpdatedAtUtc"              timestamptz     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_TenantConfiguracoes" PRIMARY KEY ("Id")
            );
            """);

        migrationBuilder.Sql("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantConfiguracoes_TenantId"
                ON "TenantConfiguracoes" ("TenantId");
            """);

        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_TenantConfiguracoes_Funcionarios_AprovadorRhId'
                ) THEN
                    ALTER TABLE "TenantConfiguracoes"
                        ADD CONSTRAINT "FK_TenantConfiguracoes_Funcionarios_AprovadorRhId"
                        FOREIGN KEY ("AprovadorRhId") REFERENCES "Funcionarios"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """);

        // ── SolicitacoesVaga: Aprovador3 (aprovação RH) ──
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "Aprovador3Id"         uuid    NULL,
                ADD COLUMN IF NOT EXISTS "Aprovador3Status"     smallint NULL,
                ADD COLUMN IF NOT EXISTS "Aprovador3DataUtc"    timestamptz NULL,
                ADD COLUMN IF NOT EXISTS "Aprovador3Habilitado" boolean NOT NULL DEFAULT false;
            """);

        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_SolicitacoesVaga_Funcionarios_Aprovador3Id'
                ) THEN
                    ALTER TABLE "SolicitacoesVaga"
                        ADD CONSTRAINT "FK_SolicitacoesVaga_Funcionarios_Aprovador3Id"
                        FOREIGN KEY ("Aprovador3Id") REFERENCES "Funcionarios"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "SolicitacoesVaga"
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_Funcionarios_Aprovador3Id",
                DROP COLUMN IF EXISTS "Aprovador3Id",
                DROP COLUMN IF EXISTS "Aprovador3Status",
                DROP COLUMN IF EXISTS "Aprovador3DataUtc",
                DROP COLUMN IF EXISTS "Aprovador3Habilitado";
            """);

        migrationBuilder.Sql("""
            ALTER TABLE "TenantConfiguracoes"
                DROP CONSTRAINT IF EXISTS "FK_TenantConfiguracoes_Funcionarios_AprovadorRhId";
            DROP INDEX IF EXISTS "IX_TenantConfiguracoes_TenantId";
            DROP TABLE IF EXISTS "TenantConfiguracoes";
            """);
    }
}
