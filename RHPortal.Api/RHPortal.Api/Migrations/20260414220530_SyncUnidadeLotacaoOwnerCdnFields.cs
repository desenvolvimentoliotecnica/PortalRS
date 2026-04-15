using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncUnidadeLotacaoOwnerCdnFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente: coluna já existe em tenants criados via 20260413000000_AddLadoToPreAdmissaoDocumento
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissaoDocumentos" ADD COLUMN IF NOT EXISTS "Lado" smallint NOT NULL DEFAULT 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Lado",
                table: "PreAdmissaoDocumentos");
        }
    }
}
