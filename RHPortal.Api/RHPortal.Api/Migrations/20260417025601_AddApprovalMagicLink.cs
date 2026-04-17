using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalMagicLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "ApprovalMagicLinks" (
                    "Id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
                    "TenantId"                 character varying(64)    NOT NULL,
                    "Token"                    character varying(64)    NOT NULL,
                    "EtapaId"                  uuid                     NOT NULL,
                    "SolicitacaoId"            uuid                     NOT NULL,
                    "TipoFluxo"                smallint                 NOT NULL,
                    "AprovadorFuncionarioId"   uuid                     NOT NULL,
                    "ExpiresAtUtc"             timestamp with time zone NOT NULL,
                    "UsedAtUtc"                timestamp with time zone NULL,
                    "AcaoRealizada"            smallint                 NULL,
                    "IpAddress"                character varying(45)    NULL,
                    "UserAgent"                character varying(512)   NULL,
                    "CreatedAtUtc"             timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_ApprovalMagicLinks" PRIMARY KEY ("Id")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_ApprovalMagicLinks_TenantId_Token"
                    ON "ApprovalMagicLinks" ("TenantId", "Token");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ApprovalMagicLinks");
        }
    }
}
