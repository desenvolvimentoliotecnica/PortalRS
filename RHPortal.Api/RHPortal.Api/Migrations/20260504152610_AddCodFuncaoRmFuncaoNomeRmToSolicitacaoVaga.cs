using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCodFuncaoRmFuncaoNomeRmToSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "CodFuncaoRm" character varying(20) NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "FuncaoNomeRm" character varying(160) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" DROP COLUMN IF EXISTS "CodFuncaoRm";
                ALTER TABLE "SolicitacoesVaga" DROP COLUMN IF EXISTS "FuncaoNomeRm";
                """);
        }
    }
}
