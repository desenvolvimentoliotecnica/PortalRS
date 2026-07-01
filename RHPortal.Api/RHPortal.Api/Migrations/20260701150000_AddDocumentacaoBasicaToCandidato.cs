using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentacaoBasicaToCandidato : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Candidatos" ADD COLUMN IF NOT EXISTS "Cpf" character varying(14) NULL;
                ALTER TABLE "Candidatos" ADD COLUMN IF NOT EXISTS "Rg" character varying(20) NULL;
                ALTER TABLE "Candidatos" ADD COLUMN IF NOT EXISTS "DataNascimento" date NULL;
                ALTER TABLE "Candidatos" ADD COLUMN IF NOT EXISTS "NomeMae" character varying(160) NULL;
                ALTER TABLE "Candidatos" ADD COLUMN IF NOT EXISTS "NomePai" character varying(160) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Candidatos" DROP COLUMN IF EXISTS "Cpf";
                ALTER TABLE "Candidatos" DROP COLUMN IF EXISTS "Rg";
                ALTER TABLE "Candidatos" DROP COLUMN IF EXISTS "DataNascimento";
                ALTER TABLE "Candidatos" DROP COLUMN IF EXISTS "NomeMae";
                ALTER TABLE "Candidatos" DROP COLUMN IF EXISTS "NomePai";
                """);
        }
    }
}
