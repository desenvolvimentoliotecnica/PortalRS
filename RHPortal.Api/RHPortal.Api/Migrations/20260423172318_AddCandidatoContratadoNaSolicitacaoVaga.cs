using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidatoContratadoNaSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CandidatoContratadoId",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_CandidatoContratadoId",
                table: "SolicitacoesVaga",
                column: "CandidatoContratadoId");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesVaga_Candidatos_CandidatoContratadoId",
                table: "SolicitacoesVaga",
                column: "CandidatoContratadoId",
                principalTable: "Candidatos",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Candidatos_CandidatoContratadoId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_CandidatoContratadoId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "CandidatoContratadoId",
                table: "SolicitacoesVaga");
        }
    }
}
