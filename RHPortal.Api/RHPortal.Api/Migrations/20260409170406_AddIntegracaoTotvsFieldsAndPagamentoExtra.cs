using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIntegracaoTotvsFieldsAndPagamentoExtra : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IntegracaoMensagem",
                table: "SolicitacoesPromocao",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "IntegracaoResultado",
                table: "SolicitacoesPromocao",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IntegradaEmUtc",
                table: "SolicitacoesPromocao",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IntegracaoMensagem",
                table: "SolicitacoesFerias",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "IntegracaoResultado",
                table: "SolicitacoesFerias",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IntegradaEmUtc",
                table: "SolicitacoesFerias",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IntegracaoMensagem",
                table: "SolicitacoesEndereco",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "IntegracaoResultado",
                table: "SolicitacoesEndereco",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IntegradaEmUtc",
                table: "SolicitacoesEndereco",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IntegracaoMensagem",
                table: "SolicitacoesDesligamento",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "IntegracaoResultado",
                table: "SolicitacoesDesligamento",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IntegradaEmUtc",
                table: "SolicitacoesDesligamento",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IntegracaoMensagem",
                table: "SolicitacoesDependente",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "IntegracaoResultado",
                table: "SolicitacoesDependente",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IntegradaEmUtc",
                table: "SolicitacoesDependente",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IntegracaoMensagem",
                table: "SolicitacoesBeneficio",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "IntegracaoResultado",
                table: "SolicitacoesBeneficio",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "IntegradaEmUtc",
                table: "SolicitacoesBeneficio",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SolicitacoesPagamentoExtra",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    TipoPagamentoExtra = table.Column<short>(type: "smallint", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DataPagamento = table.Column<DateOnly>(type: "date", nullable: false),
                    Competencia = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1Status = table.Column<short>(type: "smallint", nullable: false),
                    Aprovador1DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Id = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Status = table.Column<short>(type: "smallint", nullable: true),
                    Aprovador2DataUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    ObservacaoAprovador = table.Column<string>(type: "text", nullable: true),
                    Observacoes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IntegracaoResultado = table.Column<short>(type: "smallint", nullable: true),
                    IntegracaoMensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IntegradaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacoesPagamentoExtra", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_Aprovador1Id",
                        column: x => x.Aprovador1Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_Aprovador2Id",
                        column: x => x.Aprovador2Id,
                        principalTable: "Funcionarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SolicitacoesPagamentoExtra_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPagamentoExtra_Aprovador1Id",
                table: "SolicitacoesPagamentoExtra",
                column: "Aprovador1Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPagamentoExtra_Aprovador2Id",
                table: "SolicitacoesPagamentoExtra",
                column: "Aprovador2Id");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPagamentoExtra_FuncionarioId",
                table: "SolicitacoesPagamentoExtra",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacoesPagamentoExtra_SolicitanteId",
                table: "SolicitacoesPagamentoExtra",
                column: "SolicitanteId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SolicitacoesPagamentoExtra");

            migrationBuilder.DropColumn(
                name: "IntegracaoMensagem",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "IntegracaoResultado",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "IntegradaEmUtc",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "IntegracaoMensagem",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "IntegracaoResultado",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "IntegradaEmUtc",
                table: "SolicitacoesFerias");

            migrationBuilder.DropColumn(
                name: "IntegracaoMensagem",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "IntegracaoResultado",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "IntegradaEmUtc",
                table: "SolicitacoesEndereco");

            migrationBuilder.DropColumn(
                name: "IntegracaoMensagem",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "IntegracaoResultado",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "IntegradaEmUtc",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "IntegracaoMensagem",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "IntegracaoResultado",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "IntegradaEmUtc",
                table: "SolicitacoesDependente");

            migrationBuilder.DropColumn(
                name: "IntegracaoMensagem",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "IntegracaoResultado",
                table: "SolicitacoesBeneficio");

            migrationBuilder.DropColumn(
                name: "IntegradaEmUtc",
                table: "SolicitacoesBeneficio");
        }
    }
}
