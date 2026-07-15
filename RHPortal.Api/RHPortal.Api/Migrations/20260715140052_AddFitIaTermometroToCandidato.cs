using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFitIaTermometroToCandidato : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Candidatos" ADD COLUMN IF NOT EXISTS "FitIaNivel" character varying(32) NULL;
                ALTER TABLE "Candidatos" ADD COLUMN IF NOT EXISTS "FitIaMotivo" character varying(240) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Candidatos" DROP COLUMN IF EXISTS "FitIaNivel";
                ALTER TABLE "Candidatos" DROP COLUMN IF EXISTS "FitIaMotivo";
                """);
        }
    }
}
