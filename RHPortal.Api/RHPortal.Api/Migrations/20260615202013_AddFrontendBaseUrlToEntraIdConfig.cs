using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFrontendBaseUrlToEntraIdConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "EntraIdConfigs" ADD COLUMN IF NOT EXISTS "FrontendBaseUrl" character varying(500) NULL;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'EntraIdConfigs'
                          AND column_name = 'CallbackPath'
                          AND character_maximum_length IS NOT NULL
                          AND character_maximum_length < 500
                    ) THEN
                        ALTER TABLE "EntraIdConfigs"
                            ALTER COLUMN "CallbackPath" TYPE character varying(500);
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "EntraIdConfigs" DROP COLUMN IF EXISTS "FrontendBaseUrl";
                """);
        }
    }
}
