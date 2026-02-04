using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateEducation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoEducacaoItens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Curso = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Instituicao = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Inicio = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Fim = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Observacoes = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoEducacaoItens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoEducacaoItens_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoEducacaoResumos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nivel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    AreaPrincipal = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Situacao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Destaques = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoEducacaoResumos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoEducacaoResumos_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoItens_CandidatoId",
                table: "CandidatoEducacaoItens",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoItens_TenantId_CandidatoId",
                table: "CandidatoEducacaoItens",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoResumos_CandidatoId",
                table: "CandidatoEducacaoResumos",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoEducacaoResumos_TenantId_CandidatoId",
                table: "CandidatoEducacaoResumos",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoEducacaoItens");

            migrationBuilder.DropTable(
                name: "CandidatoEducacaoResumos");
        }
    }
}
