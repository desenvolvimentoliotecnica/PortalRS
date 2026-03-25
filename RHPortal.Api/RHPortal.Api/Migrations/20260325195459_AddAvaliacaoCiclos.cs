using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAvaliacaoCiclos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AvaliacaoCiclos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Periodo = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    CriadoPorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AvaliacaoCiclos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AvaliacaoCiclos_Funcionarios_CriadoPorId",
                        column: x => x.CriadoPorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AvaliacaoPerguntas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CicloId = table.Column<Guid>(type: "uuid", nullable: false),
                    Texto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AvaliacaoPerguntas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AvaliacaoPerguntas_AvaliacaoCiclos_CicloId",
                        column: x => x.CicloId,
                        principalTable: "AvaliacaoCiclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AvaliacaoRespostas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CicloId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvaliadorId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvaliandoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Score = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    RespostasJson = table.Column<string>(type: "text", nullable: false),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AvaliacaoRespostas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AvaliacaoRespostas_AvaliacaoCiclos_CicloId",
                        column: x => x.CicloId,
                        principalTable: "AvaliacaoCiclos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AvaliacaoRespostas_Funcionarios_AvaliadorId",
                        column: x => x.AvaliadorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AvaliacaoRespostas_Funcionarios_AvaliandoId",
                        column: x => x.AvaliandoId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoCiclos_CriadoPorId",
                table: "AvaliacaoCiclos",
                column: "CriadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoCiclos_TenantId_Status",
                table: "AvaliacaoCiclos",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoPerguntas_CicloId",
                table: "AvaliacaoPerguntas",
                column: "CicloId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_AvaliadorId",
                table: "AvaliacaoRespostas",
                column: "AvaliadorId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_AvaliandoId",
                table: "AvaliacaoRespostas",
                column: "AvaliandoId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_CicloId",
                table: "AvaliacaoRespostas",
                column: "CicloId");

            migrationBuilder.CreateIndex(
                name: "IX_AvaliacaoRespostas_TenantId_CicloId_AvaliandoId",
                table: "AvaliacaoRespostas",
                columns: new[] { "TenantId", "CicloId", "AvaliandoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AvaliacaoPerguntas");

            migrationBuilder.DropTable(
                name: "AvaliacaoRespostas");

            migrationBuilder.DropTable(
                name: "AvaliacaoCiclos");
        }
    }
}
