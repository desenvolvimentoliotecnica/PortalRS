using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailConfigSmtpTestRedirect : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "EmailConfigs" ADD COLUMN IF NOT EXISTS "SmtpUseTestRedirect" boolean NOT NULL DEFAULT false;
                ALTER TABLE "EmailConfigs" ADD COLUMN IF NOT EXISTS "SmtpTestRedirectAddress" character varying(200) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "EmailConfigs" DROP COLUMN IF EXISTS "SmtpTestRedirectAddress";
                ALTER TABLE "EmailConfigs" DROP COLUMN IF EXISTS "SmtpUseTestRedirect";
                """);
        }
    }
}
