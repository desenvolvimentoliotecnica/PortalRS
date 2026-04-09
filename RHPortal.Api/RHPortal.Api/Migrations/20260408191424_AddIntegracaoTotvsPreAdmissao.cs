using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIntegracaoTotvsPreAdmissao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "AreaId",
                table: "Vagas",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<int>(
                name: "Altura",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CartaoSus",
                table: "PreAdmissoes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CategoriaSalarial",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CentroCusto",
                table: "PreAdmissoes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodCargoTotvs",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodTurno",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodVinculoEmpregaticio",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CtpsModelo",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocMilitarNumero",
                table: "PreAdmissoes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DocMilitarRegiao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocMilitarSerie",
                table: "PreAdmissoes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DocMilitarTipo",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FatorRh",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GrauInstrucao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GrupoSanguineo",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Peso",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PossuiDeficiencia",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoFuncionario",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TituloEleitorCidade",
                table: "PreAdmissoes",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TituloEleitorUf",
                table: "PreAdmissoes",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UnidadeLotacao",
                table: "PreAdmissoes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Descricao",
                table: "FasesProcesso",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Observacoes",
                table: "FasesProcesso",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SlaDias",
                table: "FasesProcesso",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Altura",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CartaoSus",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CategoriaSalarial",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CentroCusto",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodCargoTotvs",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodTurno",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodVinculoEmpregaticio",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CtpsModelo",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DocMilitarNumero",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DocMilitarRegiao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DocMilitarSerie",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DocMilitarTipo",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "FatorRh",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "GrauInstrucao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "GrupoSanguineo",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Peso",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "PossuiDeficiencia",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TipoFuncionario",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TituloEleitorCidade",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TituloEleitorUf",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "UnidadeLotacao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Descricao",
                table: "FasesProcesso");

            migrationBuilder.DropColumn(
                name: "Observacoes",
                table: "FasesProcesso");

            migrationBuilder.DropColumn(
                name: "SlaDias",
                table: "FasesProcesso");

            migrationBuilder.AlterColumn<Guid>(
                name: "AreaId",
                table: "Vagas",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
