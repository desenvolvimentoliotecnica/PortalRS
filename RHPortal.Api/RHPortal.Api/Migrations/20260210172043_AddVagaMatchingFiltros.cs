using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaMatchingFiltros : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MatchingFiltrosOriginaisRaw",
                table: "Vagas",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MatchingFiltrosRaw",
                table: "Vagas",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MatchingFiltrosOriginaisRaw",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "MatchingFiltrosRaw",
                table: "Vagas");
        }
    }
}
