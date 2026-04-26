using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMatriculaRmToFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): coluna pode já existir em tenants antigos.
            migrationBuilder.Sql(@"ALTER TABLE ""Funcionarios"" ADD COLUMN IF NOT EXISTS ""MatriculaRm"" character varying(20) NULL;");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Funcionarios_TenantId_MatriculaRm"" ON ""Funcionarios"" (""TenantId"", ""MatriculaRm"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_TenantId_MatriculaRm",
                table: "Funcionarios");

            migrationBuilder.DropColumn(
                name: "MatriculaRm",
                table: "Funcionarios");
        }
    }
}
