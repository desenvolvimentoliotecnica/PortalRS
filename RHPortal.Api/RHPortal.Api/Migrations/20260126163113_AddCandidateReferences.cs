using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateReferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoReferencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Relacao = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Empresa = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Cargo = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Contato = table.Column<string>(type: "character varying(220)", maxLength: 220, nullable: true),
                    Periodo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Linkedin = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    PodeContatar = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoReferencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoReferencias_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoReferencias_CandidatoId",
                table: "CandidatoReferencias",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoReferencias_TenantId_CandidatoId",
                table: "CandidatoReferencias",
                columns: new[] { "TenantId", "CandidatoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoReferencias");
        }
    }
}
