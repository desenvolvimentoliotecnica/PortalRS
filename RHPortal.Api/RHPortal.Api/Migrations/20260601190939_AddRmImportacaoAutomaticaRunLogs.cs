using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmImportacaoAutomaticaRunLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RmImportacaoAutomaticaRuns" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "StartedAtUtc" timestamp with time zone NOT NULL,
                    "FinishedAtUtc" timestamp with time zone NULL,
                    "Status" character varying(30) NOT NULL,
                    "IntervalMinutes" integer NOT NULL,
                    "MaxPerRun" integer NOT NULL,
                    "TotalLidos" integer NOT NULL,
                    "Criados" integer NOT NULL,
                    "Atualizados" integer NOT NULL,
                    "VagasCriadas" integer NOT NULL,
                    "Ignorados" integer NOT NULL,
                    "Erros" integer NOT NULL,
                    "StatusSyncTotalLidos" integer NOT NULL,
                    "StatusSyncAtualizados" integer NOT NULL,
                    "StatusSyncIgnorados" integer NOT NULL,
                    "StatusSyncErros" integer NOT NULL,
                    "Mensagem" character varying(1000) NULL,
                    "LogText" text NOT NULL,
                    CONSTRAINT "PK_RmImportacaoAutomaticaRuns" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_RmImportacaoAutomaticaRuns_TenantId_StartedAtUtc"
                ON "RmImportacaoAutomaticaRuns" ("TenantId", "StartedAtUtc");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "RmImportacaoAutomaticaRuns";
                """);
        }
    }
}
