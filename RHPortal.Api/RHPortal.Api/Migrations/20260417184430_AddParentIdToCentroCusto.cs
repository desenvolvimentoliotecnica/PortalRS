using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddParentIdToCentroCusto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "ParentId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_CentrosCusto_ParentId"
                ON "CentrosCusto" ("ParentId");
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_CentrosCusto_CentrosCusto_ParentId'
                    ) THEN
                        ALTER TABLE "CentrosCusto"
                        ADD CONSTRAINT "FK_CentrosCusto_CentrosCusto_ParentId"
                        FOREIGN KEY ("ParentId")
                        REFERENCES "CentrosCusto" ("Id")
                        ON DELETE RESTRICT;
                    END IF;
                END$$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "CentrosCusto" DROP CONSTRAINT IF EXISTS "FK_CentrosCusto_CentrosCusto_ParentId";
                """);
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_CentrosCusto_ParentId";
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "ParentId";
                """);
        }
    }
}
