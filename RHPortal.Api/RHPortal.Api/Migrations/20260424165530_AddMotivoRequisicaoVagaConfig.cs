using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMotivoRequisicaoVagaConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente: multi-tenant com bancos em estados diferentes.
            // O backfill do MotivoRequisicaoId nas solicitações existentes acontece no MotivoRequisicaoVagaSeeder,
            // que roda em todo startup e popula o FK a partir do antigo enum MotivoRequisicao (coluna legada).
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "MotivosRequisicaoVagaConfig" (
                    "Id"              uuid PRIMARY KEY,
                    "TenantId"        varchar(64)  NOT NULL,
                    "Codigo"          varchar(60)  NOT NULL,
                    "Nome"            varchar(120) NOT NULL,
                    "Descricao"       varchar(500) NULL,
                    "EfeitoHeadcount" smallint     NOT NULL,
                    "IsActive"        boolean      NOT NULL,
                    "Ordem"           integer      NOT NULL,
                    "IsSystem"        boolean      NOT NULL,
                    "CreatedAtUtc"    timestamptz  NOT NULL,
                    "UpdatedAtUtc"    timestamptz  NOT NULL
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_MotivosRequisicaoVagaConfig_TenantId_Codigo"
                    ON "MotivosRequisicaoVagaConfig" ("TenantId", "Codigo");

                CREATE INDEX IF NOT EXISTS "IX_MotivosRequisicaoVagaConfig_TenantId_IsActive_Ordem"
                    ON "MotivosRequisicaoVagaConfig" ("TenantId", "IsActive", "Ordem");

                ALTER TABLE "SolicitacoesVaga"
                    ADD COLUMN IF NOT EXISTS "MotivoRequisicaoId" uuid NULL;

                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_MotivoRequisicaoId"
                    ON "SolicitacoesVaga" ("MotivoRequisicaoId");

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_SolicitacoesVaga_MotivosRequisicaoVagaConfig_MotivoRequisic~'
                          AND table_name = 'SolicitacoesVaga'
                    ) THEN
                        ALTER TABLE "SolicitacoesVaga"
                            ADD CONSTRAINT "FK_SolicitacoesVaga_MotivosRequisicaoVagaConfig_MotivoRequisic~"
                            FOREIGN KEY ("MotivoRequisicaoId")
                            REFERENCES "MotivosRequisicaoVagaConfig" ("Id")
                            ON DELETE RESTRICT;
                    END IF;
                END $$;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_MotivosRequisicaoVagaConfig_MotivoRequisic~";

                DROP INDEX IF EXISTS "IX_SolicitacoesVaga_MotivoRequisicaoId";

                ALTER TABLE "SolicitacoesVaga"
                    DROP COLUMN IF EXISTS "MotivoRequisicaoId";

                DROP INDEX IF EXISTS "IX_MotivosRequisicaoVagaConfig_TenantId_IsActive_Ordem";
                DROP INDEX IF EXISTS "IX_MotivosRequisicaoVagaConfig_TenantId_Codigo";

                DROP TABLE IF EXISTS "MotivosRequisicaoVagaConfig";
            """);
        }
    }
}
