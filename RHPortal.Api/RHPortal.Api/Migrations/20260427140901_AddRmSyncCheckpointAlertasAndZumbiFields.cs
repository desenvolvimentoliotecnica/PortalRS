using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmSyncCheckpointAlertasAndZumbiFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem ter colunas/tabelas já criadas
            // por ApplyOrphanMigrationsAsync; usamos IF NOT EXISTS pra evitar erro.

            // Vagas: campos zumbi
            migrationBuilder.Sql("""ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "CiclosAusenteRm" integer NOT NULL DEFAULT 0;""");
            migrationBuilder.Sql("""ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "UltimoCicloRmObservadoUtc" timestamp with time zone NULL;""");

            // Funcionarios: campos zumbi
            migrationBuilder.Sql("""ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "CiclosAusenteRm" integer NOT NULL DEFAULT 0;""");
            migrationBuilder.Sql("""ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "UltimoCicloRmObservadoUtc" timestamp with time zone NULL;""");

            // RmSyncCheckpoints
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RmSyncCheckpoints" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Entidade" character varying(60) NOT NULL,
                    "LastRecModifiedOn" timestamp with time zone NULL,
                    "LastRunAtUtc" timestamp with time zone NULL,
                    "LastRunStatus" character varying(20) NULL,
                    "Notes" character varying(500) NULL,
                    CONSTRAINT "PK_RmSyncCheckpoints" PRIMARY KEY ("Id")
                );
                """);
            migrationBuilder.Sql("""CREATE UNIQUE INDEX IF NOT EXISTS "IX_RmSyncCheckpoints_TenantId_Entidade" ON "RmSyncCheckpoints" ("TenantId", "Entidade");""");

            // RmSyncAlertas
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RmSyncAlertas" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Tipo" character varying(40) NOT NULL,
                    "EntidadeNome" character varying(40) NOT NULL,
                    "EntidadeId" uuid NULL,
                    "ChaveRm" character varying(80) NOT NULL,
                    "DetectadoEmUtc" timestamp with time zone NOT NULL,
                    "CiclosAusente" integer NOT NULL,
                    "ResolvidoEmUtc" timestamp with time zone NULL,
                    "ResolvidoPorId" uuid NULL,
                    "Acao" character varying(120) NULL,
                    "RunId" uuid NULL,
                    CONSTRAINT "PK_RmSyncAlertas" PRIMARY KEY ("Id")
                );
                """);
            migrationBuilder.Sql("""CREATE INDEX IF NOT EXISTS "IX_RmSyncAlertas_TenantId_ResolvidoEmUtc" ON "RmSyncAlertas" ("TenantId", "ResolvidoEmUtc");""");
            migrationBuilder.Sql("""CREATE UNIQUE INDEX IF NOT EXISTS "IX_RmSyncAlertas_TenantId_Tipo_ChaveRm" ON "RmSyncAlertas" ("TenantId", "Tipo", "ChaveRm");""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "RmSyncAlertas");
            migrationBuilder.DropTable(name: "RmSyncCheckpoints");
            migrationBuilder.DropColumn(name: "UltimoCicloRmObservadoUtc", table: "Vagas");
            migrationBuilder.DropColumn(name: "CiclosAusenteRm", table: "Vagas");
            migrationBuilder.DropColumn(name: "UltimoCicloRmObservadoUtc", table: "Funcionarios");
            migrationBuilder.DropColumn(name: "CiclosAusenteRm", table: "Funcionarios");
        }
    }
}
