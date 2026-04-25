using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPagamentoExtraEtapasWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Remove colunas e FKs do padrão antigo (Aprovador1/Aprovador2 fixos)
            // e adiciona campos de rastreio de importação (ImportadoPorId, ImportadaEmUtc).
            // Idempotente: usa IF EXISTS / IF NOT EXISTS para bancos multi-tenant.
            migrationBuilder.Sql("""
                -- Drop FKs antigas (idempotente)
                ALTER TABLE "SolicitacoesPagamentoExtra"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPagamentoExtra_Funcionarios_Aprovador1Id";
                ALTER TABLE "SolicitacoesPagamentoExtra"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPagamentoExtra_Funcionarios_Aprovador2Id";

                -- Drop índices antigos
                DROP INDEX IF EXISTS "IX_SolicitacoesPagamentoExtra_Aprovador1Id";

                -- Drop colunas antigas
                ALTER TABLE "SolicitacoesPagamentoExtra"
                    DROP COLUMN IF EXISTS "Aprovador1DataUtc",
                    DROP COLUMN IF EXISTS "Aprovador1Id",
                    DROP COLUMN IF EXISTS "Aprovador1Status",
                    DROP COLUMN IF EXISTS "Aprovador2Habilitado",
                    DROP COLUMN IF EXISTS "Aprovador2Status",
                    DROP COLUMN IF EXISTS "ObservacaoAprovador";

                -- Renomeia Aprovador2Id → ImportadoPorId (caso ainda seja o nome antigo)
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'SolicitacoesPagamentoExtra'
                          AND column_name = 'Aprovador2Id'
                    ) THEN
                        ALTER TABLE "SolicitacoesPagamentoExtra" RENAME COLUMN "Aprovador2Id" TO "ImportadoPorId";
                    END IF;
                END $$;

                -- Renomeia Aprovador2DataUtc → ImportadaEmUtc (caso ainda seja o nome antigo)
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'SolicitacoesPagamentoExtra'
                          AND column_name = 'Aprovador2DataUtc'
                    ) THEN
                        ALTER TABLE "SolicitacoesPagamentoExtra" RENAME COLUMN "Aprovador2DataUtc" TO "ImportadaEmUtc";
                    END IF;
                END $$;

                -- Renomeia índice se ainda tiver o nome antigo
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE tablename = 'SolicitacoesPagamentoExtra'
                          AND indexname = 'IX_SolicitacoesPagamentoExtra_Aprovador2Id'
                    ) THEN
                        ALTER INDEX "IX_SolicitacoesPagamentoExtra_Aprovador2Id"
                            RENAME TO "IX_SolicitacoesPagamentoExtra_ImportadoPorId";
                    END IF;
                END $$;

                -- Garante que ImportadoPorId existe (caso seja banco novo sem colunas antigas)
                ALTER TABLE "SolicitacoesPagamentoExtra"
                    ADD COLUMN IF NOT EXISTS "ImportadoPorId" uuid NULL;
                ALTER TABLE "SolicitacoesPagamentoExtra"
                    ADD COLUMN IF NOT EXISTS "ImportadaEmUtc" timestamp with time zone NULL;

                -- Garante índice para ImportadoPorId
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesPagamentoExtra_ImportadoPorId"
                    ON "SolicitacoesPagamentoExtra" ("ImportadoPorId");

                -- Garante FK para ImportadoPorId
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE table_name = 'SolicitacoesPagamentoExtra'
                          AND constraint_name = 'FK_SolicitacoesPagamentoExtra_Funcionarios_ImportadoPorId'
                    ) THEN
                        ALTER TABLE "SolicitacoesPagamentoExtra"
                            ADD CONSTRAINT "FK_SolicitacoesPagamentoExtra_Funcionarios_ImportadoPorId"
                            FOREIGN KEY ("ImportadoPorId") REFERENCES "Funcionarios" ("Id");
                    END IF;
                END $$;

                -- Aplica maxLength(2000) em Observacoes se ainda for text
                ALTER TABLE "SolicitacoesPagamentoExtra"
                    ALTER COLUMN "Observacoes" TYPE character varying(2000);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesPagamentoExtra"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPagamentoExtra_Funcionarios_ImportadoPorId";
                DROP INDEX IF EXISTS "IX_SolicitacoesPagamentoExtra_ImportadoPorId";

                ALTER TABLE "SolicitacoesPagamentoExtra"
                    ALTER COLUMN "Observacoes" TYPE text;

                ALTER TABLE "SolicitacoesPagamentoExtra"
                    ADD COLUMN IF NOT EXISTS "Aprovador1DataUtc" timestamp with time zone NULL,
                    ADD COLUMN IF NOT EXISTS "Aprovador1Id" uuid NULL,
                    ADD COLUMN IF NOT EXISTS "Aprovador1Status" smallint NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS "Aprovador2Habilitado" boolean NOT NULL DEFAULT false,
                    ADD COLUMN IF NOT EXISTS "Aprovador2Status" smallint NULL,
                    ADD COLUMN IF NOT EXISTS "ObservacaoAprovador" text NULL;

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'SolicitacoesPagamentoExtra' AND column_name = 'ImportadoPorId'
                    ) THEN
                        ALTER TABLE "SolicitacoesPagamentoExtra" RENAME COLUMN "ImportadoPorId" TO "Aprovador2Id";
                    END IF;
                END $$;

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'SolicitacoesPagamentoExtra' AND column_name = 'ImportadaEmUtc'
                    ) THEN
                        ALTER TABLE "SolicitacoesPagamentoExtra" RENAME COLUMN "ImportadaEmUtc" TO "Aprovador2DataUtc";
                    END IF;
                END $$;
                """);
        }
    }
}
