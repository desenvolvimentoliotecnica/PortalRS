using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateAccessibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoAcessibilidades",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Idioma = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Canal = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    MelhorHorario = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    ObservacoesComunicacao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    PrecisaLegendas = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaInterprete = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaLeitorTela = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaBaixaEstimulo = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaMobilidade = table.Column<bool>(type: "boolean", nullable: false),
                    PrecisaTempoExtra = table.Column<bool>(type: "boolean", nullable: false),
                    DetalhesNecessidades = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    ConsentimentoPcd = table.Column<bool>(type: "boolean", nullable: false),
                    PcdIdentificacao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PcdTipo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    PcdComprovacao = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PcdObservacoes = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoAcessibilidades", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoAcessibilidades_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAcessibilidades_CandidatoId",
                table: "CandidatoAcessibilidades",
                column: "CandidatoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoAcessibilidades_TenantId_CandidatoId",
                table: "CandidatoAcessibilidades",
                columns: new[] { "TenantId", "CandidatoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoAcessibilidades");
        }
    }
}
