using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmSyncRunsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem ter a tabela já criada
            // por ApplyOrphanMigrationsAsync; usamos IF NOT EXISTS pra evitar erro.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RmSyncRuns" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Entidade" character varying(60) NOT NULL,
                    "Operacao" character varying(20) NOT NULL,
                    "StartedAtUtc" timestamp with time zone NOT NULL,
                    "EndedAtUtc" timestamp with time zone NULL,
                    "Status" smallint NOT NULL,
                    "TotalLidos" integer NOT NULL,
                    "Criados" integer NOT NULL,
                    "Atualizados" integer NOT NULL,
                    "Ignorados" integer NOT NULL,
                    "ErroMensagem" character varying(2000) NULL,
                    "WatermarkAplicadoUtc" timestamp with time zone NULL,
                    "WatermarkNovoUtc" timestamp with time zone NULL,
                    CONSTRAINT "PK_RmSyncRuns" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_RmSyncRuns_TenantId_Entidade_StartedAtUtc" ON "RmSyncRuns" ("TenantId", "Entidade", "StartedAtUtc" DESC);""");
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_RmSyncRuns_TenantId_Status" ON "RmSyncRuns" ("TenantId", "Status");""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "RmSyncRuns");
        }
    }
}
