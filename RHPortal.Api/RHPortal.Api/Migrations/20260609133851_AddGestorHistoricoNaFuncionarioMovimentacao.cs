using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGestorHistoricoNaFuncionarioMovimentacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "FuncionarioMovimentacoes"
                    ADD COLUMN IF NOT EXISTS "GestorHistoricoChapaRm" character varying(20) NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "FuncionarioMovimentacoes"
                    ADD COLUMN IF NOT EXISTS "GestorHistoricoNome" character varying(160) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "FuncionarioMovimentacoes"
                    DROP COLUMN IF EXISTS "GestorHistoricoChapaRm";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "FuncionarioMovimentacoes"
                    DROP COLUMN IF EXISTS "GestorHistoricoNome";
                """);
        }
    }
}
