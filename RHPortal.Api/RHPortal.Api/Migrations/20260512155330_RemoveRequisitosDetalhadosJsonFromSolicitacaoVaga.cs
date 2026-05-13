using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveRequisitosDetalhadosJsonFromSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga"
                DROP COLUMN IF EXISTS "RequisitosDetalhadosJson";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "RequisitosDetalhadosJson" jsonb NULL;
                """);
        }
    }
}
