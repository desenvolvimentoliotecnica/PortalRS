using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNineBoxAssessment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Nota: IntegracaoMensagem, IntegracaoResultado e IntegradaEmUtc já foram adicionados
            // pela migration 20260324000000_AddCamposIntegracaoPreAdmissao (com SQL IF NOT EXISTS).
            // Não repetir aqui para evitar erro "column already exists" no PostgreSQL.

            migrationBuilder.CreateTable(
                name: "NineBoxAssessments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvaliadorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Desempenho = table.Column<int>(type: "integer", nullable: false),
                    Potencial = table.Column<int>(type: "integer", nullable: false),
                    Observacoes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NineBoxAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NineBoxAssessments_Funcionarios_AvaliadorId",
                        column: x => x.AvaliadorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NineBoxAssessments_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_AvaliadorId",
                table: "NineBoxAssessments",
                column: "AvaliadorId");

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_FuncionarioId",
                table: "NineBoxAssessments",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_TenantId_CriadoEmUtc",
                table: "NineBoxAssessments",
                columns: new[] { "TenantId", "CriadoEmUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_NineBoxAssessments_TenantId_FuncionarioId",
                table: "NineBoxAssessments",
                columns: new[] { "TenantId", "FuncionarioId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NineBoxAssessments");

            // As colunas IntegracaoMensagem, IntegracaoResultado e IntegradaEmUtc são gerenciadas
            // pela migration 20260324000000_AddCamposIntegracaoPreAdmissao. Não removê-las aqui.
        }
    }
}
