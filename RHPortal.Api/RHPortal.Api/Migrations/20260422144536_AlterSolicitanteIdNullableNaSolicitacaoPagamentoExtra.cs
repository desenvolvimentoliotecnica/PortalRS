using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AlterSolicitanteIdNullableNaSolicitacaoPagamentoExtra : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesPagamentoExtra_Funcionarios_SolicitanteId",
                table: "SolicitacoesPagamentoExtra");

            migrationBuilder.AlterColumn<Guid>(
                name: "SolicitanteId",
                table: "SolicitacoesPagamentoExtra",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesPagamentoExtra_Funcionarios_SolicitanteId",
                table: "SolicitacoesPagamentoExtra",
                column: "SolicitanteId",
                principalTable: "Funcionarios",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesPagamentoExtra_Funcionarios_SolicitanteId",
                table: "SolicitacoesPagamentoExtra");

            migrationBuilder.AlterColumn<Guid>(
                name: "SolicitanteId",
                table: "SolicitacoesPagamentoExtra",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesPagamentoExtra_Funcionarios_SolicitanteId",
                table: "SolicitacoesPagamentoExtra",
                column: "SolicitanteId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
