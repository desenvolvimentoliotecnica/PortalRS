using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateLgpdConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatoLgpdConsents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CandidatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessarCandidatura = table.Column<bool>(type: "boolean", nullable: false),
                    PermitirContato = table.Column<bool>(type: "boolean", nullable: false),
                    BancoTalentos = table.Column<bool>(type: "boolean", nullable: false),
                    RetencaoMeses = table.Column<int>(type: "integer", nullable: true),
                    Compartilhamento = table.Column<short>(type: "smallint", nullable: true),
                    DadosSensiveis = table.Column<bool>(type: "boolean", nullable: false),
                    Comunicacoes = table.Column<bool>(type: "boolean", nullable: false),
                    ConsentidoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevogadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatoLgpdConsents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidatoLgpdConsents_Candidatos_CandidatoId",
                        column: x => x.CandidatoId,
                        principalTable: "Candidatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoLgpdConsents_CandidatoId",
                table: "CandidatoLgpdConsents",
                column: "CandidatoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidatoLgpdConsents_TenantId_CandidatoId",
                table: "CandidatoLgpdConsents",
                columns: new[] { "TenantId", "CandidatoId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatoLgpdConsents");
        }
    }
}
