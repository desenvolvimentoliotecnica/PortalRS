using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidatePreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoPreferenciasVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    CargoAlvo = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Senioridade = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    InicioDisponivel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Resumo = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    AreasInteresse = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    ModeloTrabalho = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Jornada = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    TipoContrato = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Viagens = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Mudanca = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CidadePreferida = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    DistanciaMaxKm = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ObsDeslocamento = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PretensaoSalarial = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PretensaoNegociavel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    BeneficiosDesejados = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    NaoAbreMaoDe = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoPreferenciasVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoPreferenciasVaga_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPreferenciasVaga_CandidatoId",
                table: "CandidatoPreferenciasVaga",
                column: "CandidatoId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoPreferenciasVaga_TenantId_CandidatoId",
                table: "CandidatoPreferenciasVaga",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoPreferenciasVaga");
        }
    }
}
