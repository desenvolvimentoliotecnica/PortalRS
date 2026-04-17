using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHolerite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Holerites" (
                    "Id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
                    "TenantId"        character varying(64)    NOT NULL,
                    "FuncionarioId"   uuid                     NOT NULL,
                    "MesReferencia"   integer                  NOT NULL,
                    "AnoReferencia"   integer                  NOT NULL,
                    "ArquivoPath"     character varying(500)   NOT NULL,
                    "ArquivoNome"     character varying(255)   NOT NULL,
                    "TamanhoBytes"    bigint                   NOT NULL DEFAULT 0,
                    "EnviadoPorId"    uuid                     NULL,
                    "EnviadoEmUtc"    timestamp with time zone NOT NULL DEFAULT now(),
                    "CreatedAtUtc"    timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_Holerites" PRIMARY KEY ("Id")
                );

                -- Índice único: um holerite por funcionário por mês/ano
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Holerites_TenantId_FuncionarioId_Ano_Mes"
                    ON "Holerites" ("TenantId", "FuncionarioId", "AnoReferencia", "MesReferencia");

                CREATE INDEX IF NOT EXISTS "IX_Holerites_TenantId_FuncionarioId"
                    ON "Holerites" ("TenantId", "FuncionarioId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Holerites");
        }
    }
}
