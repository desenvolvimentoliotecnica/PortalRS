using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTalentoExperienciaResumoNivel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NivelHierarquico",
                table: "TalentoExperiencias",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NivelSenioridade",
                table: "TalentoExperiencias",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResumoAtividades",
                table: "TalentoExperiencias",
                type: "character varying(800)",
                maxLength: 800,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NivelHierarquico",
                table: "TalentoExperiencias");

            migrationBuilder.DropColumn(
                name: "NivelSenioridade",
                table: "TalentoExperiencias");

            migrationBuilder.DropColumn(
                name: "ResumoAtividades",
                table: "TalentoExperiencias");
        }
    }
}
