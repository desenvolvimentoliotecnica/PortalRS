using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRespostaCampoPersonalizadoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RespostasCampoPersonalizadoVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    VagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    CampoId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValorTexto = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RespostasCampoPersonalizadoVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RespostasCampoPersonalizadoVaga_CamposPersonalizadosVaga_Ca~",
                        column: x => x.CampoId,
                        principalTable: "CamposPersonalizadosVaga",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RespostasCampoPersonalizadoVaga_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RespostasCampoPersonalizadoVaga_Vagas_VagaId",
                        column: x => x.VagaId,
                        principalTable: "Vagas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_CampoId",
                table: "RespostasCampoPersonalizadoVaga",
                column: "CampoId");

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_CandidatoId",
                table: "RespostasCampoPersonalizadoVaga",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_TenantId_VagaId_CandidatoId",
                table: "RespostasCampoPersonalizadoVaga",
                columns: new[] { "TenantId", "VagaId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_RespostasCampoPersonalizadoVaga_VagaId",
                table: "RespostasCampoPersonalizadoVaga",
                column: "VagaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RespostasCampoPersonalizadoVaga");
        }
    }
}
