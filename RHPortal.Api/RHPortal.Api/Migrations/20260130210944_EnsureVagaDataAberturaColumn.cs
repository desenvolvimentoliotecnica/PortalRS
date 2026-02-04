using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnsureVagaDataAberturaColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente: garante colunas de SLA em Vagas (ex.: banco de tenant criado antes da migração AddVagaSlaFields).
            migrationBuilder.Sql(@"
                ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""DataAbertura"" timestamp with time zone NULL;
                ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""SlaDiasMetaFechamento"" integer NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
