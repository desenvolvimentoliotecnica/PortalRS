using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRegraAprovacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RegrasAprovacaoVaga",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SolicitanteRoleId = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador1FuncionarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Aprovador2FuncionarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    Aprovador2Habilitado = table.Column<bool>(type: "boolean", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegrasAprovacaoVaga", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Funcionarios_Aprovador1FuncionarioId",
                        column: x => x.Aprovador1FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Funcionarios_Aprovador2FuncionarioId",
                        column: x => x.Aprovador2FuncionarioId,
                        principalTable: "Funcionarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RegrasAprovacaoVaga_Roles_SolicitanteRoleId",
                        column: x => x.SolicitanteRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_Aprovador1FuncionarioId",
                table: "RegrasAprovacaoVaga",
                column: "Aprovador1FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_Aprovador2FuncionarioId",
                table: "RegrasAprovacaoVaga",
                column: "Aprovador2FuncionarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_SolicitanteRoleId",
                table: "RegrasAprovacaoVaga",
                column: "SolicitanteRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasAprovacaoVaga_TenantId_SolicitanteRoleId",
                table: "RegrasAprovacaoVaga",
                columns: new[] { "TenantId", "SolicitanteRoleId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RegrasAprovacaoVaga");
        }
    }
}
