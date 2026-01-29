using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateDocumentColumns : Migration
    {
        /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "CandidatoDocumentos"
            ADD COLUMN IF NOT EXISTS "ArquivoNome" character varying(260);
        """);

        migrationBuilder.Sql("""
            ALTER TABLE "CandidatoDocumentos"
            ADD COLUMN IF NOT EXISTS "DataReferencia" character varying(20);
        """);
    }

        /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "CandidatoDocumentos"
            DROP COLUMN IF EXISTS "ArquivoNome";
        """);

        migrationBuilder.Sql("""
            ALTER TABLE "CandidatoDocumentos"
            DROP COLUMN IF EXISTS "DataReferencia";
        """);
    }
}
}
