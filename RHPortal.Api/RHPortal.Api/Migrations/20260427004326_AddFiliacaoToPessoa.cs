using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFiliacaoToPessoa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""NomePai"" character varying(160) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""NomeMae"" character varying(160) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Pessoas"" ADD COLUMN IF NOT EXISTS ""Nacionalidade"" character varying(60) NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Nacionalidade", table: "Pessoas");
            migrationBuilder.DropColumn(name: "NomeMae", table: "Pessoas");
            migrationBuilder.DropColumn(name: "NomePai", table: "Pessoas");
        }
    }
}
