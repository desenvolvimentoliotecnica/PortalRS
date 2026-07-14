using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUsarIaParseCurriculoToTenantConfiguracao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "UsarIaParseCurriculo" boolean NOT NULL DEFAULT true;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "UsarIaParseCurriculo";
                """);
        }
    }
}
