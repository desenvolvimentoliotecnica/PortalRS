using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailMessageAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "EmailMessageAttachments" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "EmailMessageId" uuid NOT NULL,
                    "FileName" character varying(260) NOT NULL,
                    "ContentType" character varying(160) NULL,
                    "SizeBytes" bigint NOT NULL,
                    "ContentBytes" bytea NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_EmailMessageAttachments" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_EmailMessageAttachments_EmailMessages_EmailMessageId') THEN
                        ALTER TABLE "EmailMessageAttachments"
                            ADD CONSTRAINT "FK_EmailMessageAttachments_EmailMessages_EmailMessageId"
                            FOREIGN KEY ("EmailMessageId") REFERENCES "EmailMessages"("Id") ON DELETE CASCADE;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_EmailMessageAttachments_EmailMessageId"
                    ON "EmailMessageAttachments" ("EmailMessageId");
                CREATE INDEX IF NOT EXISTS "IX_EmailMessageAttachments_TenantId_EmailMessageId"
                    ON "EmailMessageAttachments" ("TenantId", "EmailMessageId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailMessageAttachments");
        }
    }
}
