using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmWorkerCycleSettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem já ter tabela aplicada manualmente ou via orphan.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RmWorkerCycleSettings" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "IntervalMinutes" integer NOT NULL DEFAULT 5,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_RmWorkerCycleSettings" PRIMARY KEY ("Id")
                );
                """);
            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_RmWorkerCycleSettings_TenantId"
                ON "RmWorkerCycleSettings" ("TenantId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RmWorkerCycleSettings");
        }
    }
}
