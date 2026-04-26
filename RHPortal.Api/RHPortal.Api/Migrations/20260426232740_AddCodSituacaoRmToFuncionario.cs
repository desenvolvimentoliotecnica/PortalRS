using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCodSituacaoRmToFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): colunas/índice podem já existir em tenants antigos.
            migrationBuilder.Sql(@"ALTER TABLE ""Funcionarios"" ADD COLUMN IF NOT EXISTS ""CodSituacaoRm"" character varying(5) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Funcionarios"" ADD COLUMN IF NOT EXISTS ""SituacaoRmDescricao"" character varying(60) NULL;");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Funcionarios_TenantId_CodSituacaoRm"" ON ""Funcionarios"" (""TenantId"", ""CodSituacaoRm"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Funcionarios_TenantId_CodSituacaoRm", table: "Funcionarios");
            migrationBuilder.DropColumn(name: "CodSituacaoRm", table: "Funcionarios");
            migrationBuilder.DropColumn(name: "SituacaoRmDescricao", table: "Funcionarios");
        }
    }
}
