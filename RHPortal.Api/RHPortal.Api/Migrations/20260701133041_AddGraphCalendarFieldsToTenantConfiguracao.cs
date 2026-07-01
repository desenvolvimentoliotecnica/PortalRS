using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGraphCalendarFieldsToTenantConfiguracao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "GraphCalendarTenantId" text NULL;
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "GraphCalendarClientId" text NULL;
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "GraphCalendarClientSecretEncrypted" text NULL;
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "GraphCalendarUserUpn" text NULL;
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "GraphCalendarEnabled" boolean NOT NULL DEFAULT false;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "GraphCalendarEnabled";
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "GraphCalendarUserUpn";
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "GraphCalendarClientSecretEncrypted";
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "GraphCalendarClientId";
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "GraphCalendarTenantId";
                """);
        }
    }
}
