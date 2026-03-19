using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class Sprint_P2_PermissaoNivelVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DescricaoPublicacao",
                table: "JobPositions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "NivelHierarquicoId",
                table: "JobPositions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsReadOnly",
                table: "CamposPersonalizadosVaga",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ValorPadrao",
                table: "CamposPersonalizadosVaga",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AprovacoesFaixaSalarial",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FaixaSalarialId = table.Column<Guid>(type: "uuid", nullable: false),
                    SolicitanteId = table.Column<Guid>(type: "uuid", nullable: true),
                    ValorProposto = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Justificativa = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    AprovadorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObservacaoAprovador = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AprovadoEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AprovacoesFaixaSalarial", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AprovacoesFaixaSalarial_FaixasSalariais_FaixaSalarialId",
                        column: x => x.FaixaSalarialId,
                        principalTable: "FaixasSalariais",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AprovacoesFaixaSalarial_Funcionarios_AprovadorId",
                        column: x => x.AprovadorId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AprovacoesFaixaSalarial_Funcionarios_SolicitanteId",
                        column: x => x.SolicitanteId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PermissoesNivelVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    NivelHierarquicoId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PermissoesNivelVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PermissoesNivelVaga_NiveisHierarquicos_NivelHierarquicoId",
                        column: x => x.NivelHierarquicoId,
                        principalTable: "NiveisHierarquicos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PermissoesNivelVaga_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_JobPositions_NivelHierarquicoId",
                table: "JobPositions",
                column: "NivelHierarquicoId");

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_AprovadorId",
                table: "AprovacoesFaixaSalarial",
                column: "AprovadorId");

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_FaixaSalarialId",
                table: "AprovacoesFaixaSalarial",
                column: "FaixaSalarialId");

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_SolicitanteId",
                table: "AprovacoesFaixaSalarial",
                column: "SolicitanteId");

            migrationBuilder.CreateIndex(
                name: "IX_AprovacoesFaixaSalarial_TenantId_Status",
                table: "AprovacoesFaixaSalarial",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PermissoesNivelVaga_NivelHierarquicoId",
                table: "PermissoesNivelVaga",
                column: "NivelHierarquicoId");

            migrationBuilder.CreateIndex(
                name: "IX_PermissoesNivelVaga_RoleId",
                table: "PermissoesNivelVaga",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_PermissoesNivelVaga_TenantId_NivelHierarquicoId_RoleId",
                table: "PermissoesNivelVaga",
                columns: new[] { "TenantId", "NivelHierarquicoId", "RoleId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_JobPositions_NiveisHierarquicos_NivelHierarquicoId",
                table: "JobPositions",
                column: "NivelHierarquicoId",
                principalTable: "NiveisHierarquicos",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_JobPositions_NiveisHierarquicos_NivelHierarquicoId",
                table: "JobPositions");

            migrationBuilder.DropTable(
                name: "AprovacoesFaixaSalarial");

            migrationBuilder.DropTable(
                name: "PermissoesNivelVaga");

            migrationBuilder.DropIndex(
                name: "IX_JobPositions_NivelHierarquicoId",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "DescricaoPublicacao",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "NivelHierarquicoId",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "IsReadOnly",
                table: "CamposPersonalizadosVaga");

            migrationBuilder.DropColumn(
                name: "ValorPadrao",
                table: "CamposPersonalizadosVaga");
        }
    }
}
