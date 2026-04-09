using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCargoIdAndJobPositionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CargoId",
                table: "Vagas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OccupationalClassification",
                table: "JobPositions",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_CargoId",
                table: "Vagas",
                column: "CargoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_Cargos_CargoId",
                table: "Vagas",
                column: "CargoId",
                principalTable: "Cargos",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_Cargos_CargoId",
                table: "Vagas");

            migrationBuilder.DropIndex(
                name: "IX_Vagas_CargoId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "CargoId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "OccupationalClassification",
                table: "JobPositions");
        }
    }
}
