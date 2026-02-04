using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaSlaFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DataAbertura",
                table: "Vagas",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SlaDiasMetaFechamento",
                table: "Vagas",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RecrutadorResponsavelUserId",
                table: "Vagas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_RecrutadorResponsavelUserId",
                table: "Vagas",
                column: "RecrutadorResponsavelUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_Users_RecrutadorResponsavelUserId",
                table: "Vagas",
                column: "RecrutadorResponsavelUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_Users_RecrutadorResponsavelUserId",
                table: "Vagas");

            migrationBuilder.DropIndex(
                name: "IX_Vagas_RecrutadorResponsavelUserId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "DataAbertura",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "SlaDiasMetaFechamento",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "RecrutadorResponsavelUserId",
                table: "Vagas");
        }
    }
}
