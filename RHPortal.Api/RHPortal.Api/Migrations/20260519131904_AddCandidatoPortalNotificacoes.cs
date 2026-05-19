using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidatoPortalNotificacoes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoPortalNotificacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CandidaturaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Tipo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Titulo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Mensagem = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CamposPendentesJson = table.Column<string>(type: "text", nullable: true),
                    LidaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ResolvidaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CriadaPorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CriadaPorNome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoPortalNotificacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoPortalNotificacoes_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CandidatoPortalNotificacoes_Candidaturas_CandidaturaId",
                        column: x => x.CandidaturaId,
                        principalTable: "Candidaturas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CandidatoPortalNotificacoes_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortalNotificacoes_CandidatoId",
                table: "CandidatoPortalNotificacoes",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortalNotificacoes_CandidaturaId",
                table: "CandidatoPortalNotificacoes",
                column: "CandidaturaId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortalNotificacoes_TenantId_CandidatoId_CreatedAtU~",
                table: "CandidatoPortalNotificacoes",
                columns: new[] { "TenantId", "CandidatoId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortalNotificacoes_TenantId_CandidatoId_ResolvidaE~",
                table: "CandidatoPortalNotificacoes",
                columns: new[] { "TenantId", "CandidatoId", "ResolvidaEmUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortalNotificacoes_VagaId",
                table: "CandidatoPortalNotificacoes",
                column: "VagaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoPortalNotificacoes");
        }
    }
}
