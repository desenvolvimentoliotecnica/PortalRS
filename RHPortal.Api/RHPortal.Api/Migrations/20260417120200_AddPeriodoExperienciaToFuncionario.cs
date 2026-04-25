using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPeriodoExperienciaToFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Funcionarios"
                    ADD COLUMN IF NOT EXISTS "PeriodoExperienciaDias" integer NOT NULL DEFAULT 90;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PeriodoExperienciaDias",
                table: "Funcionarios");
        }
    }
}
