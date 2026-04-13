using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAprovador123LegacyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesBeneficio_Funcionarios_Aprovador1Id",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesBeneficio_Funcionarios_Aprovador2Id",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesDependente_Funcionarios_Aprovador1Id",
                table: "SolicitacoesDependente");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesDependente_Funcionarios_Aprovador2Id",
                table: "SolicitacoesDependente");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesDesligamento_Funcionarios_Aprovador1Id",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesDesligamento_Funcionarios_Aprovador2Id",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesEndereco_Funcionarios_Aprovador1Id",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesEndereco_Funcionarios_Aprovador2Id",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesFerias_Funcionarios_Aprovador1Id",
                table: "SolicitacoesFerias");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesFerias_Funcionarios_Aprovador2Id",
                table: "SolicitacoesFerias");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesPromocao_Funcionarios_Aprovador1Id",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesPromocao_Funcionarios_Aprovador2Id",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador1Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador2Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador3Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropTable(
                name: "RegrasAprovacaoVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_Aprovador1Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_Aprovador2Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesVaga_Aprovador3Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesPromocao_Aprovador1Id",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesPromocao_Aprovador2Id",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesFerias_Aprovador1Id",
                table: "SolicitacoesFerias");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesFerias_Aprovador2Id",
                table: "SolicitacoesFerias");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesEndereco_Aprovador1Id",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesEndereco_Aprovador2Id",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesDesligamento_Aprovador1Id",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesDesligamento_Aprovador2Id",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesDependente_Aprovador1Id",
                table: "SolicitacoesDependente");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesDependente_Aprovador2Id",
                table: "SolicitacoesDependente");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesBeneficio_Aprovador1Id",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesBeneficio_Aprovador2Id",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador3DataUtc",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador3Habilitado",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador3Id",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador3Status",
                table: "SolicitacoesVaga");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "Aprovador1Id",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "Aprovador1Status",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "Aprovador2Id",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "Aprovador2Status",
                table: "SolicitacoesBeneficio");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesVaga",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesVaga",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesVaga",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador3DataUtc",
                table: "SolicitacoesVaga",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador3Habilitado",
                table: "SolicitacoesVaga",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador3Id",
                table: "SolicitacoesVaga",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador3Status",
                table: "SolicitacoesVaga",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesPromocao",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesPromocao",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesPromocao",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesPromocao",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesPromocao",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesPromocao",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesPromocao",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesFerias",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesFerias",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesFerias",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesFerias",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesFerias",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesFerias",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesFerias",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesEndereco",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesEndereco",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesEndereco",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesEndereco",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesEndereco",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesEndereco",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesEndereco",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesDesligamento",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesDesligamento",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesDesligamento",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesDesligamento",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesDesligamento",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesDesligamento",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesDesligamento",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesDependente",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesDependente",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesDependente",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesDependente",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesDependente",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesDependente",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesDependente",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador1DataUtc",
                table: "SolicitacoesBeneficio",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador1Id",
                table: "SolicitacoesBeneficio",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador1Status",
                table: "SolicitacoesBeneficio",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Aprovador2DataUtc",
                table: "SolicitacoesBeneficio",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Aprovador2Habilitado",
                table: "SolicitacoesBeneficio",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "Aprovador2Id",
                table: "SolicitacoesBeneficio",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Aprovador2Status",
                table: "SolicitacoesBeneficio",
                type: "smallint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RegrasAprovacaoVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Aprovador1FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Aprovador2FuncionarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    SolicitanteRoleId = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegrasAprovacaoVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Funcionarios_Aprovador1FuncionarioId",
                        column: x => x.Aprovador1FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Funcionarios_Aprovador2FuncionarioId",
                        column: x => x.Aprovador2FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Roles_SolicitanteRoleId",
                        column: x => x.SolicitanteRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_Aprovador1Id",
                table: "SolicitacoesVaga",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_Aprovador2Id",
                table: "SolicitacoesVaga",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesVaga_Aprovador3Id",
                table: "SolicitacoesVaga",
                column: "Aprovador3Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_Aprovador1Id",
                table: "SolicitacoesPromocao",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPromocao_Aprovador2Id",
                table: "SolicitacoesPromocao",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesFerias_Aprovador1Id",
                table: "SolicitacoesFerias",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesFerias_Aprovador2Id",
                table: "SolicitacoesFerias",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesEndereco_Aprovador1Id",
                table: "SolicitacoesEndereco",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesEndereco_Aprovador2Id",
                table: "SolicitacoesEndereco",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDesligamento_Aprovador1Id",
                table: "SolicitacoesDesligamento",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDesligamento_Aprovador2Id",
                table: "SolicitacoesDesligamento",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDependente_Aprovador1Id",
                table: "SolicitacoesDependente",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesDependente_Aprovador2Id",
                table: "SolicitacoesDependente",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesBeneficio_Aprovador1Id",
                table: "SolicitacoesBeneficio",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesBeneficio_Aprovador2Id",
                table: "SolicitacoesBeneficio",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_Aprovador1FuncionarioId",
                table: "RegrasAprovacaoVaga",
                column: "Aprovador1FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_Aprovador2FuncionarioId",
                table: "RegrasAprovacaoVaga",
                column: "Aprovador2FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_SolicitanteRoleId",
                table: "RegrasAprovacaoVaga",
                column: "SolicitanteRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_TenantId_SolicitanteRoleId",
                table: "RegrasAprovacaoVaga",
                columns: new[] { "TenantId", "SolicitanteRoleId" });

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesBeneficio_Funcionarios_Aprovador1Id",
                table: "SolicitacoesBeneficio",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesBeneficio_Funcionarios_Aprovador2Id",
                table: "SolicitacoesBeneficio",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesDependente_Funcionarios_Aprovador1Id",
                table: "SolicitacoesDependente",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesDependente_Funcionarios_Aprovador2Id",
                table: "SolicitacoesDependente",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesDesligamento_Funcionarios_Aprovador1Id",
                table: "SolicitacoesDesligamento",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesDesligamento_Funcionarios_Aprovador2Id",
                table: "SolicitacoesDesligamento",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesEndereco_Funcionarios_Aprovador1Id",
                table: "SolicitacoesEndereco",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesEndereco_Funcionarios_Aprovador2Id",
                table: "SolicitacoesEndereco",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesFerias_Funcionarios_Aprovador1Id",
                table: "SolicitacoesFerias",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesFerias_Funcionarios_Aprovador2Id",
                table: "SolicitacoesFerias",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesPromocao_Funcionarios_Aprovador1Id",
                table: "SolicitacoesPromocao",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesPromocao_Funcionarios_Aprovador2Id",
                table: "SolicitacoesPromocao",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador1Id",
                table: "SolicitacoesVaga",
                column: "Aprovador1Id",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador2Id",
                table: "SolicitacoesVaga",
                column: "Aprovador2Id",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SolicitacoesVaga_Funcionarios_Aprovador3Id",
                table: "SolicitacoesVaga",
                column: "Aprovador3Id",
                principalTable: "Funcionarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
