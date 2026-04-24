using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentacaoPadraoPorCargoTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Multi-tenant: idempotente — ALTER TABLE ... ADD COLUMN IF NOT EXISTS
            migrationBuilder.Sql("""
                ALTER TABLE "DocumentacaoPadraoHistoricos"
                    ADD COLUMN IF NOT EXISTS "CargoId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DocumentacaoPadraoPorCargoConfigs" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "JobPositionId" uuid NOT NULL,
                    "TipoDocumento" smallint NOT NULL,
                    "Configuracao" smallint NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_DocumentacaoPadraoPorCargoConfigs" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_DocumentacaoPadraoPorCargoConfigs_JobPositions_JobPositionId"
                        FOREIGN KEY ("JobPositionId") REFERENCES "JobPositions" ("Id") ON DELETE CASCADE
                );
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoHistoricos_CargoId"
                    ON "DocumentacaoPadraoHistoricos" ("CargoId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoHistoricos_TenantId_Escopo_CargoId"
                    ON "DocumentacaoPadraoHistoricos" ("TenantId", "Escopo", "CargoId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoPorCargoConfigs_JobPositionId"
                    ON "DocumentacaoPadraoPorCargoConfigs" ("JobPositionId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoPorCargoConfigs_TenantId_JobPositionId"
                    ON "DocumentacaoPadraoPorCargoConfigs" ("TenantId", "JobPositionId");
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoPorCargoConfigs_TenantId_JobPositionId_Ti~"
                    ON "DocumentacaoPadraoPorCargoConfigs" ("TenantId", "JobPositionId", "TipoDocumento");
                """);

            // FK para CargoId no histórico — adicionada idempotente via DO block (PG não tem ADD CONSTRAINT IF NOT EXISTS).
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_DocumentacaoPadraoHistoricos_JobPositions_CargoId'
                    ) THEN
                        ALTER TABLE "DocumentacaoPadraoHistoricos"
                            ADD CONSTRAINT "FK_DocumentacaoPadraoHistoricos_JobPositions_CargoId"
                            FOREIGN KEY ("CargoId") REFERENCES "JobPositions" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DocumentacaoPadraoHistoricos_JobPositions_CargoId",
                table: "DocumentacaoPadraoHistoricos");

            migrationBuilder.DropTable(
                name: "DocumentacaoPadraoPorCargoConfigs");

            migrationBuilder.DropIndex(
                name: "IX_DocumentacaoPadraoHistoricos_CargoId",
                table: "DocumentacaoPadraoHistoricos");

            migrationBuilder.DropIndex(
                name: "IX_DocumentacaoPadraoHistoricos_TenantId_Escopo_CargoId",
                table: "DocumentacaoPadraoHistoricos");

            migrationBuilder.DropColumn(
                name: "CargoId",
                table: "DocumentacaoPadraoHistoricos");
        }
    }
}
