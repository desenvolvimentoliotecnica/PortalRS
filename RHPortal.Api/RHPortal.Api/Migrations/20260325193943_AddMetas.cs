using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMetas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Metas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadaPorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Titulo = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Descricao = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ValorMeta = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    ValorAtual = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    Unidade = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Prazo = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    CriadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Metas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Metas_Funcionarios_CriadaPorId",
                        column: x => x.CriadaPorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Metas_Funcionarios_FuncionarioId",
                        column: x => x.FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Metas_CriadaPorId",
                table: "Metas",
                column: "CriadaPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Metas_FuncionarioId",
                table: "Metas",
                column: "FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Metas_TenantId_FuncionarioId",
                table: "Metas",
                columns: new[] { "TenantId", "FuncionarioId" });

            migrationBuilder.CreateIndex(
                name: "IX_Metas_TenantId_Status",
                table: "Metas",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Metas");
        }
    }
}
