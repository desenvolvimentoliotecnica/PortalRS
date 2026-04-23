using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificacaoCandidaturaLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "NotificacoesCandidaturaLogs" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "CandidaturaId" uuid NOT NULL,
                    "CandidatoId" uuid NOT NULL,
                    "EtapaMacro" smallint NOT NULL,
                    "Canal" smallint NOT NULL,
                    "Status" smallint NOT NULL,
                    "Destino" character varying(200) NULL,
                    "Mensagem" character varying(4000) NULL,
                    "ErroMensagem" character varying(1000) NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_NotificacoesCandidaturaLogs" PRIMARY KEY ("Id")
                );

                CREATE INDEX IF NOT EXISTS "IX_NotificacoesCandidaturaLogs_TenantId_CandidaturaId"
                    ON "NotificacoesCandidaturaLogs" ("TenantId", "CandidaturaId");

                CREATE INDEX IF NOT EXISTS "IX_NotificacoesCandidaturaLogs_TenantId_CandidatoId"
                    ON "NotificacoesCandidaturaLogs" ("TenantId", "CandidatoId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "NotificacoesCandidaturaLogs";
                """);
        }
    }
}
