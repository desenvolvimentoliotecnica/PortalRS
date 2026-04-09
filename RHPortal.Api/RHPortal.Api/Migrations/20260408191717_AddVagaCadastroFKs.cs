using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaCadastroFKs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CategoriaSalarialId",
                table: "Vagas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CentroCustoId",
                table: "Vagas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TurnoId",
                table: "Vagas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UnidadeLotacaoId",
                table: "Vagas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_CategoriaSalarialId",
                table: "Vagas",
                column: "CategoriaSalarialId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_CentroCustoId",
                table: "Vagas",
                column: "CentroCustoId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_TurnoId",
                table: "Vagas",
                column: "TurnoId");

            migrationBuilder.CreateIndex(
                name: "IX_Vagas_UnidadeLotacaoId",
                table: "Vagas",
                column: "UnidadeLotacaoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_CategoriasSalariais_CategoriaSalarialId",
                table: "Vagas",
                column: "CategoriaSalarialId",
                principalTable: "CategoriasSalariais",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_CentrosCusto_CentroCustoId",
                table: "Vagas",
                column: "CentroCustoId",
                principalTable: "CentrosCusto",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_Turnos_TurnoId",
                table: "Vagas",
                column: "TurnoId",
                principalTable: "Turnos",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Vagas_UnidadesLotacao_UnidadeLotacaoId",
                table: "Vagas",
                column: "UnidadeLotacaoId",
                principalTable: "UnidadesLotacao",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_CategoriasSalariais_CategoriaSalarialId",
                table: "Vagas");

            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_CentrosCusto_CentroCustoId",
                table: "Vagas");

            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_Turnos_TurnoId",
                table: "Vagas");

            migrationBuilder.DropForeignKey(
                name: "FK_Vagas_UnidadesLotacao_UnidadeLotacaoId",
                table: "Vagas");

            migrationBuilder.DropIndex(
                name: "IX_Vagas_CategoriaSalarialId",
                table: "Vagas");

            migrationBuilder.DropIndex(
                name: "IX_Vagas_CentroCustoId",
                table: "Vagas");

            migrationBuilder.DropIndex(
                name: "IX_Vagas_TurnoId",
                table: "Vagas");

            migrationBuilder.DropIndex(
                name: "IX_Vagas_UnidadeLotacaoId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "CategoriaSalarialId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "CentroCustoId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "TurnoId",
                table: "Vagas");

            migrationBuilder.DropColumn(
                name: "UnidadeLotacaoId",
                table: "Vagas");
        }
    }
}
