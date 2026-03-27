using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentoSolicitadoAndAccessToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: column may already exist from a partial previous run
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreAdmissoes' AND column_name='AccessToken') THEN
                        ALTER TABLE "PreAdmissoes" ADD COLUMN "AccessToken" character varying(64) NULL;
                    END IF;
                END $$;
            """);

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "PreAdmissaoDocumentosSolicitados" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "PreAdmissaoId" uuid NOT NULL,
                    "TipoDocumento" smallint NOT NULL,
                    "Obrigatorio" boolean NOT NULL DEFAULT true,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_PreAdmissaoDocumentosSolicitados" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_PreAdmissaoDocumentosSolicitados_PreAdmissoes_PreAdmissaoId" FOREIGN KEY ("PreAdmissaoId") REFERENCES "PreAdmissoes" ("Id") ON DELETE CASCADE
                );
            """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_PreAdmissoes_TenantId_AccessToken" ON "PreAdmissoes" ("TenantId", "AccessToken") WHERE "AccessToken" IS NOT NULL;
                CREATE INDEX IF NOT EXISTS "IX_PreAdmissaoDocumentosSolicitados_PreAdmissaoId" ON "PreAdmissaoDocumentosSolicitados" ("PreAdmissaoId");
                CREATE INDEX IF NOT EXISTS "IX_PreAdmissaoDocumentosSolicitados_TenantId_PreAdmissaoId" ON "PreAdmissaoDocumentosSolicitados" ("TenantId", "PreAdmissaoId");
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PreAdmissaoDocumentosSolicitados");

            migrationBuilder.DropIndex(
                name: "IX_PreAdmissoes_TenantId_AccessToken",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "AccessToken",
                table: "PreAdmissoes");
        }
    }
}
