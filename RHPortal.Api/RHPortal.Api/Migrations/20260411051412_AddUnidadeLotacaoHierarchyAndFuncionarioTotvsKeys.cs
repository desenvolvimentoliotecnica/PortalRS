using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUnidadeLotacaoHierarchyAndFuncionarioTotvsKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Manager",
                table: "UnidadesLotacao");

            migrationBuilder.AddColumn<int>(
                name: "Level",
                table: "UnidadesLotacao",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "OwnerCdnEmpresa",
                table: "UnidadesLotacao",
                type: "character varying(3)",
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerCdnEstab",
                table: "UnidadesLotacao",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerCdnFuncionario",
                table: "UnidadesLotacao",
                type: "character varying(12)",
                maxLength: 12,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerFuncionarioId",
                table: "UnidadesLotacao",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentId",
                table: "UnidadesLotacao",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SequenceNumber",
                table: "UnidadesLotacao",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CnhObrigatoria",
                table: "SolicitacoesVaga",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "DisponibilidadeViagens",
                table: "SolicitacoesVaga",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "EscalaTrabalho",
                table: "SolicitacoesVaga",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "MotivoRequisicao",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrazoDias",
                table: "SolicitacoesVaga",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "TipoContrato",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<short>(
                name: "MotivoMovimentacao",
                table: "SolicitacoesPromocao",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "NovaUnidadeId",
                table: "SolicitacoesPromocao",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PossuiEstabilidade",
                table: "SolicitacoesDesligamento",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CdnEmpresa",
                table: "Funcionarios",
                type: "character varying(3)",
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CdnEstab",
                table: "Funcionarios",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CdnFuncionario",
                table: "Funcionarios",
                type: "character varying(12)",
                maxLength: 12,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UnidadesLotacao_OwnerFuncionarioId",
                table: "UnidadesLotacao",
                column: "OwnerFuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_UnidadesLotacao_ParentId",
                table: "UnidadesLotacao",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_NovaUnidadeId",
                table: "SolicitacoesPromocao",
                column: "NovaUnidadeId");

            migrationBuilder.CreateIndex(
                name: "IX_Funcionarios_TenantId_CdnEmpresa_CdnEstab_CdnFuncionario",
                table: "Funcionarios",
                columns: new[] { "TenantId", "CdnEmpresa", "CdnEstab", "CdnFuncionario" },
                unique: true,
                filter: "\"CdnFuncionario\" IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesPromocao_Units_NovaUnidadeId",
                table: "SolicitacoesPromocao",
                column: "NovaUnidadeId",
                principalTable: "Units",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UnidadesLotacao_Funcionarios_OwnerFuncionarioId",
                table: "UnidadesLotacao",
                column: "OwnerFuncionarioId",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_UnidadesLotacao_UnidadesLotacao_ParentId",
                table: "UnidadesLotacao",
                column: "ParentId",
                principalTable: "UnidadesLotacao",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesPromocao_Units_NovaUnidadeId",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropForeignKey(
                name: "FK_UnidadesLotacao_Funcionarios_OwnerFuncionarioId",
                table: "UnidadesLotacao");

            migrationBuilder.DropForeignKey(
                name: "FK_UnidadesLotacao_UnidadesLotacao_ParentId",
                table: "UnidadesLotacao");

            migrationBuilder.DropIndex(
                name: "IX_UnidadesLotacao_OwnerFuncionarioId",
                table: "UnidadesLotacao");

            migrationBuilder.DropIndex(
                name: "IX_UnidadesLotacao_ParentId",
                table: "UnidadesLotacao");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesPromocao_NovaUnidadeId",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_TenantId_CdnEmpresa_CdnEstab_CdnFuncionario",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "UnidadesLotacao");

            migrationBuilder.DropColumn(
                name: "OwnerCdnEmpresa",
                table: "UnidadesLotacao");

            migrationBuilder.DropColumn(
                name: "OwnerCdnEstab",
                table: "UnidadesLotacao");

            migrationBuilder.DropColumn(
                name: "OwnerCdnFuncionario",
                table: "UnidadesLotacao");

            migrationBuilder.DropColumn(
                name: "OwnerFuncionarioId",
                table: "UnidadesLotacao");

            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "UnidadesLotacao");

            migrationBuilder.DropColumn(
                name: "SequenceNumber",
                table: "UnidadesLotacao");

            migrationBuilder.DropColumn(
                name: "CnhObrigatoria",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "DisponibilidadeViagens",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "EscalaTrabalho",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "MotivoRequisicao",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "PrazoDias",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "TipoContrato",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "MotivoMovimentacao",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "NovaUnidadeId",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "PossuiEstabilidade",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "CdnEmpresa",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "CdnEstab",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "CdnFuncionario",
                table: "Funcionarios");

            migrationBuilder.AddColumn<string>(
                name: "Manager",
                table: "UnidadesLotacao",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);
        }
    }
}
