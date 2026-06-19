using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiotecnicaHub.Web.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferDirectoryAuthToHubUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "HubUsers" ADD COLUMN IF NOT EXISTS "PreferDirectoryAuth" boolean NOT NULL DEFAULT false;
                """);

            migrationBuilder.Sql("""
                UPDATE "HubUsers" u
                SET "PreferDirectoryAuth" = true
                FROM "HubAdmins" a
                WHERE lower(u."Email") = lower(a."Email")
                  AND u."PasswordHash" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PreferDirectoryAuth",
                table: "HubUsers");
        }
    }
}
