using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificacoesTemplatesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente p/ cenário multi-tenant: a tabela pode já existir em bancos
            // antigos que rodaram um script manual; só cria quando não existir.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "NotificacoesTemplates" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Etapa" smallint NOT NULL,
                    "Canal" smallint NOT NULL,
                    "Assunto" character varying(240) NULL,
                    "Corpo" character varying(4000) NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_NotificacoesTemplates" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_NotificacoesTemplates_TenantId_Etapa_Canal"
                    ON "NotificacoesTemplates" ("TenantId", "Etapa", "Canal");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificacoesTemplates");
        }
    }
}
