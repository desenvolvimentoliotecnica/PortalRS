using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaWeightsAndRequisitoCategoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PesoCompetencia",
                table: "Vagas",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PesoExperiencia",
                table: "Vagas",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PesoFormacao",
                table: "Vagas",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PesoLocalidade",
                table: "Vagas",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Categoria",
                table: "VagaRequisitos",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PesoCompetencia",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "PesoExperiencia",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "PesoFormacao",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "PesoLocalidade",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "Categoria",
                table: "VagaRequisitos");
        }
    }
}
