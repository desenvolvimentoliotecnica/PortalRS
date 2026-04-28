using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFuncaoRmToVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""CodFuncaoRm"" character varying(20) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""FuncaoNomeRm"" character varying(160) NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "FuncaoNomeRm", table: "Vagas");
            migrationBuilder.DropColumn(name: "CodFuncaoRm", table: "Vagas");
        }
    }
}
