using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHeadcountEOcupacaoHistorico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "HeadcountAutorizado" integer NOT NULL DEFAULT 1;

                CREATE TABLE IF NOT EXISTS "OcupacoesHistorico" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "VagaId" uuid NOT NULL,
                    "FuncionarioId" uuid NOT NULL,
                    "DataEntrada" timestamp with time zone NOT NULL,
                    "DataSaida" timestamp with time zone NULL,
                    "MotivoSaida" text NULL,
                    "SolicitacaoOrigemId" uuid NULL,
                    CONSTRAINT "PK_OcupacoesHistorico" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_OcupacoesHistorico_Vagas_VagaId" FOREIGN KEY ("VagaId")
                        REFERENCES "Vagas" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_OcupacoesHistorico_Funcionarios_FuncionarioId" FOREIGN KEY ("FuncionarioId")
                        REFERENCES "Funcionarios" ("Id") ON DELETE RESTRICT
                );

                CREATE INDEX IF NOT EXISTS "IX_OcupacoesHistorico_TenantId_FuncionarioId_DataSaida"
                    ON "OcupacoesHistorico" ("TenantId", "FuncionarioId", "DataSaida");

                CREATE INDEX IF NOT EXISTS "IX_OcupacoesHistorico_TenantId_VagaId"
                    ON "OcupacoesHistorico" ("TenantId", "VagaId");

                CREATE INDEX IF NOT EXISTS "IX_OcupacoesHistorico_FuncionarioId"
                    ON "OcupacoesHistorico" ("FuncionarioId");

                CREATE INDEX IF NOT EXISTS "IX_OcupacoesHistorico_VagaId"
                    ON "OcupacoesHistorico" ("VagaId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OcupacoesHistorico");

            migrationBuilder.DropColumn(
                name: "HeadcountAutorizado",
                table: "Vagas");
        }
    }
}
