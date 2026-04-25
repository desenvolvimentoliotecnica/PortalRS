using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations.Master
{
    /// <inheritdoc />
    public partial class AddTenantScreens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente: TenantModules e TenantPackages podem já existir em bancos antigos.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "TenantModules" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "ModuleKey" character varying(64) NOT NULL,
                    "IsEnabled" boolean NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedByOwnerId" uuid NULL,
                    CONSTRAINT "PK_TenantModules" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_TenantModules_Owners_UpdatedByOwnerId"
                        FOREIGN KEY ("UpdatedByOwnerId") REFERENCES "Owners" ("Id") ON DELETE SET NULL,
                    CONSTRAINT "FK_TenantModules_Tenants_TenantId"
                        FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("TenantId") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantModules_TenantId_ModuleKey"
                    ON "TenantModules" ("TenantId", "ModuleKey");
                CREATE INDEX IF NOT EXISTS "IX_TenantModules_UpdatedByOwnerId"
                    ON "TenantModules" ("UpdatedByOwnerId");

                CREATE TABLE IF NOT EXISTS "TenantPackages" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "PackageKey" character varying(64) NOT NULL,
                    "IsEnabled" boolean NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedByOwnerId" uuid NULL,
                    CONSTRAINT "PK_TenantPackages" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_TenantPackages_Owners_UpdatedByOwnerId"
                        FOREIGN KEY ("UpdatedByOwnerId") REFERENCES "Owners" ("Id") ON DELETE SET NULL,
                    CONSTRAINT "FK_TenantPackages_Tenants_TenantId"
                        FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("TenantId") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantPackages_TenantId_PackageKey"
                    ON "TenantPackages" ("TenantId", "PackageKey");
                CREATE INDEX IF NOT EXISTS "IX_TenantPackages_UpdatedByOwnerId"
                    ON "TenantPackages" ("UpdatedByOwnerId");

                CREATE TABLE IF NOT EXISTS "TenantScreens" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "NavItemId" character varying(64) NOT NULL,
                    "Estado" character varying(16) NOT NULL DEFAULT 'ativo',
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedByOwnerId" uuid NULL,
                    CONSTRAINT "PK_TenantScreens" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_TenantScreens_Owners_UpdatedByOwnerId"
                        FOREIGN KEY ("UpdatedByOwnerId") REFERENCES "Owners" ("Id") ON DELETE SET NULL,
                    CONSTRAINT "FK_TenantScreens_Tenants_TenantId"
                        FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("TenantId") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantScreens_TenantId_NavItemId"
                    ON "TenantScreens" ("TenantId", "NavItemId");
                CREATE INDEX IF NOT EXISTS "IX_TenantScreens_UpdatedByOwnerId"
                    ON "TenantScreens" ("UpdatedByOwnerId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "TenantScreens");
        }
    }
}
