using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHistoricoStatusAndSlaConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "HistoricosStatus" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "TipoEntidade" smallint NOT NULL,
                    "EntidadeId" uuid NOT NULL,
                    "StatusAnterior" character varying(80) NOT NULL,
                    "StatusNovo" character varying(80) NOT NULL,
                    "AlteradoPorFuncionarioId" uuid NULL,
                    "AlteradoPorUserId" uuid NULL,
                    "AlteradoPorNome" character varying(200) NOT NULL,
                    "AlteradoEmUtc" timestamp with time zone NOT NULL,
                    "SlaEsperadoHoras" integer NULL,
                    "TempoNoStatusAnteriorHoras" double precision NULL,
                    "DentroDoSla" boolean NULL,
                    "Observacao" character varying(1000) NULL,
                    CONSTRAINT "PK_HistoricosStatus" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "SlaStatusConfigs" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "TipoEntidade" smallint NOT NULL,
                    "Status" character varying(80) NOT NULL,
                    "SlaHoras" integer NOT NULL,
                    "Ativo" boolean NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_SlaStatusConfigs" PRIMARY KEY ("Id")
                );

                CREATE INDEX IF NOT EXISTS "IX_HistoricosStatus_TenantId_TipoEntidade_EntidadeId"
                    ON "HistoricosStatus" ("TenantId", "TipoEntidade", "EntidadeId");

                CREATE INDEX IF NOT EXISTS "IX_HistoricosStatus_TenantId_AlteradoEmUtc"
                    ON "HistoricosStatus" ("TenantId", "AlteradoEmUtc");

                CREATE INDEX IF NOT EXISTS "IX_HistoricosStatus_TenantId_TipoEntidade_DentroDoSla"
                    ON "HistoricosStatus" ("TenantId", "TipoEntidade", "DentroDoSla");

                CREATE INDEX IF NOT EXISTS "IX_HistoricosStatus_TenantId_TipoEntidade_StatusNovo"
                    ON "HistoricosStatus" ("TenantId", "TipoEntidade", "StatusNovo");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_SlaStatusConfigs_TenantId_TipoEntidade_Status"
                    ON "SlaStatusConfigs" ("TenantId", "TipoEntidade", "Status");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "HistoricosStatus");
            migrationBuilder.DropTable(name: "SlaStatusConfigs");
        }
    }
}
