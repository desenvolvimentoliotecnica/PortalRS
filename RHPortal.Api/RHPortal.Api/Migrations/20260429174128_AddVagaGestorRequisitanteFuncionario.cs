using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaGestorRequisitanteFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GestorRequisitanteFuncionarioId",
                table: "Vagas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_GestorRequisitanteFuncionarioId",
                table: "Vagas",
                column: "GestorRequisitanteFuncionarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_Funcionarios_GestorRequisitanteFuncionarioId",
                table: "Vagas",
                column: "GestorRequisitanteFuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_Funcionarios_GestorRequisitanteFuncionarioId",
                table: "Vagas");

            migrationBuilder.DropIndex(
                name: "IX_Vagas_GestorRequisitanteFuncionarioId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "GestorRequisitanteFuncionarioId",
                table: "Vagas");
        }
    }
}
