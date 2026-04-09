using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class VagaJobPositionRef : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_Cargos_CargoId",
                table: "Vagas");

            migrationBuilder.RenameColumn(
                name: "CargoId",
                table: "Vagas",
                newName: "JobPositionId");

            migrationBuilder.RenameIndex(
                name: "IX_Vagas_CargoId",
                table: "Vagas",
                newName: "IX_Vagas_JobPositionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_JobPositions_JobPositionId",
                table: "Vagas",
                column: "JobPositionId",
                principalTable: "JobPositions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_JobPositions_JobPositionId",
                table: "Vagas");

            migrationBuilder.RenameColumn(
                name: "JobPositionId",
                table: "Vagas",
                newName: "CargoId");

            migrationBuilder.RenameIndex(
                name: "IX_Vagas_JobPositionId",
                table: "Vagas",
                newName: "IX_Vagas_CargoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_Cargos_CargoId",
                table: "Vagas",
                column: "CargoId",
                principalTable: "Cargos",
                principalColumn: "Id");
        }
    }
}
