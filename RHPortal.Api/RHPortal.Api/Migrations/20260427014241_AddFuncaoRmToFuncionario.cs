using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFuncaoRmToFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Funcionarios"" ADD COLUMN IF NOT EXISTS ""CodFuncaoRm"" character varying(20) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Funcionarios"" ADD COLUMN IF NOT EXISTS ""FuncaoNomeRm"" character varying(160) NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "FuncaoNomeRm", table: "Funcionarios");
            migrationBuilder.DropColumn(name: "CodFuncaoRm", table: "Funcionarios");
        }
    }
}
