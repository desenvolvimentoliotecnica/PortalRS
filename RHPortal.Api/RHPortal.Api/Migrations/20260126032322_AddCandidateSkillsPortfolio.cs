using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateSkillsPortfolio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoCertificacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Instituicao = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Ano = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoCertificacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoCertificacoes_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoCompetencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Nivel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Evidencia = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoCompetencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoCompetencias_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoPortfolios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkModel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Availability = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Salary = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Shift = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Linkedin = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Github = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Portfolio = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Drive = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoPortfolios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoPortfolios_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCertificacoes_CandidatoId",
                table: "CandidatoCertificacoes",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCertificacoes_TenantId_CandidatoId",
                table: "CandidatoCertificacoes",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCompetencias_CandidatoId",
                table: "CandidatoCompetencias",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoCompetencias_TenantId_CandidatoId",
                table: "CandidatoCompetencias",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortfolios_CandidatoId",
                table: "CandidatoPortfolios",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPortfolios_TenantId_CandidatoId",
                table: "CandidatoPortfolios",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoCertificacoes");

            migrationBuilder.DropTable(
                name: "CandidatoCompetencias");

            migrationBuilder.DropTable(
                name: "CandidatoPortfolios");
        }
    }
}
