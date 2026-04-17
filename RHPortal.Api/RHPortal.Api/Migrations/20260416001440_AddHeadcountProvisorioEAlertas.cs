using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHeadcountProvisorioEAlertas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Vaga: campos de headcount provisório e snooze de alerta
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas"
                    ADD COLUMN IF NOT EXISTS "HeadcountProvisorio" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "HeadcountProvisorioExpiresAtUtc" timestamp with time zone NULL,
                    ADD COLUMN IF NOT EXISTS "AlertaVagaSemFillSnoozeAteUtc" timestamp with time zone NULL;
                """);

            // OcupacaoHistorico: campos de slot provisório
            migrationBuilder.Sql("""
                ALTER TABLE "OcupacoesHistorico"
                    ADD COLUMN IF NOT EXISTS "IsProvisorio" boolean NOT NULL DEFAULT false,
                    ADD COLUMN IF NOT EXISTS "ProvisorioExpiresAtUtc" timestamp with time zone NULL;
                """);

            // TenantConfiguracao: parâmetros de headcount
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                    ADD COLUMN IF NOT EXISTS "DiasProvisaoSubstituicao" integer NOT NULL DEFAULT 30,
                    ADD COLUMN IF NOT EXISTS "DiasAlertaVagaSemFill" integer NOT NULL DEFAULT 60;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas"
                    DROP COLUMN IF EXISTS "HeadcountProvisorio",
                    DROP COLUMN IF EXISTS "HeadcountProvisorioExpiresAtUtc",
                    DROP COLUMN IF EXISTS "AlertaVagaSemFillSnoozeAteUtc";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "OcupacoesHistorico"
                    DROP COLUMN IF EXISTS "IsProvisorio",
                    DROP COLUMN IF EXISTS "ProvisorioExpiresAtUtc";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                    DROP COLUMN IF EXISTS "DiasProvisaoSubstituicao",
                    DROP COLUMN IF EXISTS "DiasAlertaVagaSemFill";
                """);
        }
    }
}
