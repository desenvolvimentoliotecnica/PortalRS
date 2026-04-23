using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAlcadaSalarialToVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente — tenants existentes podem já ter alguma coluna parcial.
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "TravarFaixaSalarial" boolean NOT NULL DEFAULT false;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "AlcadaSalarialAprovadaPorUserId" uuid NULL;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "AlcadaSalarialAprovadaEmUtc" timestamp with time zone NULL;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "AlcadaSalarialJustificativa" character varying(1000) NULL;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "AlcadaSalarialObservacaoAprovador" character varying(500) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "AlcadaSalarialObservacaoAprovador";
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "AlcadaSalarialJustificativa";
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "AlcadaSalarialAprovadaEmUtc";
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "AlcadaSalarialAprovadaPorUserId";
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "TravarFaixaSalarial";
                """);
        }
    }
}
