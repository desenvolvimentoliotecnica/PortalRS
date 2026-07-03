using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPermanenciaTurnoverToEixoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "EixosVaga" ADD COLUMN IF NOT EXISTS "PermanenciaNaoAplica" boolean NOT NULL DEFAULT false;
                ALTER TABLE "EixosVaga" ADD COLUMN IF NOT EXISTS "PermanenciaTurnoverDias" integer NULL;
                ALTER TABLE "EixosVaga" ADD COLUMN IF NOT EXISTS "PermanenciaTurnoverMeses" integer NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "EixosVaga" DROP COLUMN IF EXISTS "PermanenciaNaoAplica";
                ALTER TABLE "EixosVaga" DROP COLUMN IF EXISTS "PermanenciaTurnoverDias";
                ALTER TABLE "EixosVaga" DROP COLUMN IF EXISTS "PermanenciaTurnoverMeses";
                """);
        }
    }
}
