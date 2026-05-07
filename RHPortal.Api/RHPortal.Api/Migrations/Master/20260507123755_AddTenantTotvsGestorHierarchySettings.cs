using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations.Master
{
    /// <inheritdoc />
    public partial class AddTenantTotvsGestorHierarchySettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "TenantTotvsGestorHierarchySettings" (
                    "TenantId" character varying(64) NOT NULL,
                    "ConsultaUrlTemplate" character varying(2048) NOT NULL DEFAULT '',
                    "HttpUser" character varying(200) NOT NULL DEFAULT '',
                    "PasswordEncrypted" text NULL,
                    "DefaultCodColigada" integer NOT NULL DEFAULT 1,
                    "DelayMsBetweenRequests" integer NOT NULL DEFAULT 250,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_TenantTotvsGestorHierarchySettings" PRIMARY KEY ("TenantId"),
                    CONSTRAINT "FK_TenantTotvsGestorHierarchySettings_Tenants_TenantId"
                        FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("TenantId") ON DELETE CASCADE
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "TenantTotvsGestorHierarchySettings";""");
        }
    }
}
