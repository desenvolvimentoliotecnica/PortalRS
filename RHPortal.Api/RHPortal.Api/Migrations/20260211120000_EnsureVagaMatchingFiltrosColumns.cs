using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <summary>
    /// Garante que as colunas de matching existam na tabela Vagas em todos os bancos
    /// (default e tenants). Idempotente: usa IF NOT EXISTS para não falhar se já aplicado
    /// pela migration AddVagaMatchingFiltros ou por SQL manual.
    /// </summary>
    public partial class EnsureVagaMatchingFiltrosColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Vagas""
                ADD COLUMN IF NOT EXISTS ""MatchingFiltrosOriginaisRaw"" text NULL;
            ");
            migrationBuilder.Sql(@"
                ALTER TABLE ""Vagas""
                ADD COLUMN IF NOT EXISTS ""MatchingFiltrosRaw"" text NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" DROP COLUMN IF EXISTS ""MatchingFiltrosOriginaisRaw"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" DROP COLUMN IF EXISTS ""MatchingFiltrosRaw"";");
        }
    }
}
