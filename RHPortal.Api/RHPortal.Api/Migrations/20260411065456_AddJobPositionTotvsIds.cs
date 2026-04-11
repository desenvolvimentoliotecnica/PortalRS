using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddJobPositionTotvsIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: ADD COLUMN IF NOT EXISTS para evitar erro se colunas já existem
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesPromocao"
                    ADD COLUMN IF NOT EXISTS "HorarioProposto"     text    NULL,
                    ADD COLUMN IF NOT EXISTS "NovaLocalidade"      text    NULL,
                    ADD COLUMN IF NOT EXISTS "NovaPericulosidade"  text    NULL,
                    ADD COLUMN IF NOT EXISTS "NovaRemuneracao"     numeric NULL,
                    ADD COLUMN IF NOT EXISTS "NovoSalario"         numeric NULL,
                    ADD COLUMN IF NOT EXISTS "UnitId"              uuid    NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesDesligamento"
                    ADD COLUMN IF NOT EXISTS "EmpresaId"                    uuid    NULL,
                    ADD COLUMN IF NOT EXISTS "HistoricoMedidasDisciplinares" boolean NULL,
                    ADD COLUMN IF NOT EXISTS "UnitId"                       uuid    NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "JobPositions"
                    ADD COLUMN IF NOT EXISTS "TotvsCargoBasicId" integer NULL,
                    ADD COLUMN IF NOT EXISTS "TotvsNivCargoId"   integer NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesPromocao_UnitId"
                    ON "SolicitacoesPromocao" ("UnitId");

                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesDesligamento_EmpresaId"
                    ON "SolicitacoesDesligamento" ("EmpresaId");

                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesDesligamento_UnitId"
                    ON "SolicitacoesDesligamento" ("UnitId");
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_JobPositions_TenantId_TotvsCargoBasicId_TotvsNivCargoId"
                    ON "JobPositions" ("TenantId", "TotvsCargoBasicId", "TotvsNivCargoId")
                    WHERE "TotvsCargoBasicId" IS NOT NULL AND "TotvsNivCargoId" IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SolicitacoesDesligamento_Empresas_EmpresaId') THEN
                        ALTER TABLE "SolicitacoesDesligamento"
                            ADD CONSTRAINT "FK_SolicitacoesDesligamento_Empresas_EmpresaId"
                            FOREIGN KEY ("EmpresaId") REFERENCES "Empresas"("Id");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SolicitacoesDesligamento_Units_UnitId') THEN
                        ALTER TABLE "SolicitacoesDesligamento"
                            ADD CONSTRAINT "FK_SolicitacoesDesligamento_Units_UnitId"
                            FOREIGN KEY ("UnitId") REFERENCES "Units"("Id");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SolicitacoesPromocao_Units_UnitId') THEN
                        ALTER TABLE "SolicitacoesPromocao"
                            ADD CONSTRAINT "FK_SolicitacoesPromocao_Units_UnitId"
                            FOREIGN KEY ("UnitId") REFERENCES "Units"("Id");
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesDesligamento_Empresas_EmpresaId",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesDesligamento_Units_UnitId",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropForeignKey(
                name: "FK_SolicitacoesPromocao_Units_UnitId",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesPromocao_UnitId",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesDesligamento_EmpresaId",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropIndex(
                name: "IX_SolicitacoesDesligamento_UnitId",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropIndex(
                name: "IX_JobPositions_TenantId_TotvsCargoBasicId_TotvsNivCargoId",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "HorarioProposto",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "NovaLocalidade",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "NovaPericulosidade",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "NovaRemuneracao",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "NovoSalario",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "UnitId",
                table: "SolicitacoesPromocao");

            migrationBuilder.DropColumn(
                name: "EmpresaId",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "HistoricoMedidasDisciplinares",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "UnitId",
                table: "SolicitacoesDesligamento");

            migrationBuilder.DropColumn(
                name: "TotvsCargoBasicId",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "TotvsNivCargoId",
                table: "JobPositions");
        }
    }
}
