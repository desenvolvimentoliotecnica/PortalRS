using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmImportacaoAutomaticaTenantConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmImportacaoAutomaticaAtiva" boolean NOT NULL DEFAULT false;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmImportacaoAutomaticaIntervaloMinutos" integer NOT NULL DEFAULT 15;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmImportacaoAutomaticaMaxPorExecucao" integer NOT NULL DEFAULT 50;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmImportacaoAutomaticaAtiva";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmImportacaoAutomaticaIntervaloMinutos";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmImportacaoAutomaticaMaxPorExecucao";
                """);
        }
    }
}
