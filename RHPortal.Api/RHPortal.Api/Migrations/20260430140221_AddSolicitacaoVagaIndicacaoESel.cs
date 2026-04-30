using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSolicitacaoVagaIndicacaoESel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SolicitacaoVagaIndicacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SolicitacaoVagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Observacao = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IndicadoPorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacaoVagaIndicacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacaoVagaIndicacoes_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitacaoVagaIndicacoes_SolicitacoesVaga_SolicitacaoVagaId",
                        column: x => x.SolicitacaoVagaId,
                        principalTable: "SolicitacoesVaga",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacaoVagaIndicacoes_CandidatoId",
                table: "SolicitacaoVagaIndicacoes",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacaoVagaIndicacoes_SolicitacaoVagaId",
                table: "SolicitacaoVagaIndicacoes",
                column: "SolicitacaoVagaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacaoVagaIndicacoes_TenantId_CandidatoId",
                table: "SolicitacaoVagaIndicacoes",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacaoVagaIndicacoes_TenantId_SolicitacaoVagaId",
                table: "SolicitacaoVagaIndicacoes",
                columns: new[] { "TenantId", "SolicitacaoVagaId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SolicitacaoVagaIndicacoes");
        }
    }
}
