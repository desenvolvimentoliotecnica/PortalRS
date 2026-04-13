using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFuncionarioUnidadeLotacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UnidadeLotacaoId",
                table: "Funcionarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_UnidadeLotacaoId",
                table: "Funcionarios",
                column: "UnidadeLotacaoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Funcionarios_UnidadesLotacao_UnidadeLotacaoId",
                table: "Funcionarios",
                column: "UnidadeLotacaoId",
                principalTable: "UnidadesLotacao",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Funcionarios_UnidadesLotacao_UnidadeLotacaoId",
                table: "Funcionarios");

            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_UnidadeLotacaoId",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "UnidadeLotacaoId",
                table: "Funcionarios");
        }
    }
}
