using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSolicitacaoVagaRmStatusSyncFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "RmStatusSyncUltimaMensagem" character varying(2000) NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "RmUltimaStatusDescricaoRm" character varying(240) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga" DROP COLUMN IF EXISTS "RmStatusSyncUltimaMensagem";
                ALTER TABLE "SolicitacoesVaga" DROP COLUMN IF EXISTS "RmUltimaStatusDescricaoRm";
                """);
        }
    }
}
