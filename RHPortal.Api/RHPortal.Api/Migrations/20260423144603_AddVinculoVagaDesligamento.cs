using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVinculoVagaDesligamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DataDesligamento",
                table: "SolicitacoesVaga",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DesligamentoVinculadoId",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DiasAvisoPrevioDesligamento",
                table: "SolicitacoesVaga",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotivoDesligamentoTexto",
                table: "SolicitacoesVaga",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PossuiEstabilidadeDesligamento",
                table: "SolicitacoesVaga",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "TipoAvisoPrevioDesligamento",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SolicitacaoVagaOrigemId",
                table: "SolicitacoesDesligamento",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DataDesligamento",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "DesligamentoVinculadoId",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "DiasAvisoPrevioDesligamento",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "MotivoDesligamentoTexto",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "PossuiEstabilidadeDesligamento",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "TipoAvisoPrevioDesligamento",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "SolicitacaoVagaOrigemId",
                table: "SolicitacoesDesligamento");
        }
    }
}
