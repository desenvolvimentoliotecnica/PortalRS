using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTalentoProfileTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TalentoCompetencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Nivel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Evidencia = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoCompetencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoCompetencias_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoDocumentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    NomeArquivo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Descricao = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    StorageFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    TamanhoBytes = table.Column<long>(type: "bigint", nullable: true),
                    DataReferencia = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoDocumentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoDocumentos_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoExperiencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_TalentoExperiencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoExperiencias_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoFormacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_TalentoFormacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoFormacoes_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TalentoTreinamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TalentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Instituicao = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Ano = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Link = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalentoTreinamentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TalentoTreinamentos_Talentos_TalentoId",
                        column: x => x.TalentoId,
                        principalTable: "Talentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCompetencias_TalentoId",
                table: "TalentoCompetencias",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoCompetencias_TenantId_TalentoId",
                table: "TalentoCompetencias",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoDocumentos_TalentoId",
                table: "TalentoDocumentos",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoDocumentos_TenantId_TalentoId",
                table: "TalentoDocumentos",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoExperiencias_TalentoId",
                table: "TalentoExperiencias",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoExperiencias_TenantId_TalentoId",
                table: "TalentoExperiencias",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoFormacoes_TalentoId",
                table: "TalentoFormacoes",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoFormacoes_TenantId_TalentoId",
                table: "TalentoFormacoes",
                columns: new[] { "TenantId", "TalentoId" });

            migrationBuilder.CreateIndex(
                name: "IX_TalentoTreinamentos_TalentoId",
                table: "TalentoTreinamentos",
                column: "TalentoId");

            migrationBuilder.CreateIndex(
                name: "IX_TalentoTreinamentos_TenantId_TalentoId",
                table: "TalentoTreinamentos",
                columns: new[] { "TenantId", "TalentoId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TalentoCompetencias");

            migrationBuilder.DropTable(
                name: "TalentoDocumentos");

            migrationBuilder.DropTable(
                name: "TalentoExperiencias");

            migrationBuilder.DropTable(
                name: "TalentoFormacoes");

            migrationBuilder.DropTable(
                name: "TalentoTreinamentos");
        }
    }
}
