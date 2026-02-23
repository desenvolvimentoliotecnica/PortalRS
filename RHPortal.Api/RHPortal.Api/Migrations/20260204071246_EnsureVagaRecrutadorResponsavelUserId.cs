using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <summary>
    /// Garante que a coluna RecrutadorResponsavelUserId existe na tabela Vagas
    /// (bancos de tenant com histórico de migrações inconsistente).
    /// </summary>
    public partial class EnsureVagaRecrutadorResponsavelUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""RecrutadorResponsavelUserId"" uuid NULL;
            ");
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_Vagas_RecrutadorResponsavelUserId"" ON ""Vagas"" (""RecrutadorResponsavelUserId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Não remove: outros bancos podem ter a coluna legítima
        }
    }
}
