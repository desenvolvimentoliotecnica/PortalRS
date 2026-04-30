using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSolicitacaoVagaIntegracaoTentativas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SolicitacaoVagaIntegracaoTentativas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SolicitacaoVagaId = table.Column<Guid>(type: "uuid", nullable: false),
                    TentativaEmUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Sucesso = table.Column<bool>(type: "boolean", nullable: false),
                    PayloadResumo = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                    MensagemErro = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CodigoTecnico = table.Column<int>(type: "integer", nullable: true),
                    CodigoRmRetornado = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitacaoVagaIntegracaoTentativas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitacaoVagaIntegracaoTentativas_SolicitacoesVaga_Solici~",
                        column: x => x.SolicitacaoVagaId,
                        principalTable: "SolicitacoesVaga",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacaoVagaIntegracaoTentativas_SolicitacaoVagaId",
                table: "SolicitacaoVagaIntegracaoTentativas",
                column: "SolicitacaoVagaId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitacaoVagaIntegracaoTentativas_TenantId_SolicitacaoVag~",
                table: "SolicitacaoVagaIntegracaoTentativas",
                columns: new[] { "TenantId", "SolicitacaoVagaId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SolicitacaoVagaIntegracaoTentativas");
        }
    }
}
