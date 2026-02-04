using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateExperienceProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoExperiencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Empresa = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Cargo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Inicio = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Fim = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Local = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Atividades = table.Column<string>(type: "character varying(2400)", maxLength: 2400, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoExperiencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoExperiencias_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidatoProjetos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Periodo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Descricao = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Stack = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Destaques = table.Column<string>(type: "character varying(1600)", maxLength: 1600, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoProjetos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoProjetos_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoExperiencias_CandidatoId",
                table: "CandidatoExperiencias",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoExperiencias_TenantId_CandidatoId",
                table: "CandidatoExperiencias",
                columns: new[] { "TenantId", "CandidatoId" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoProjetos_CandidatoId",
                table: "CandidatoProjetos",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoProjetos_TenantId_CandidatoId",
                table: "CandidatoProjetos",
                columns: new[] { "TenantId", "CandidatoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoExperiencias");

            migrationBuilder.DropTable(
                name: "CandidatoProjetos");
        }
    }
}
