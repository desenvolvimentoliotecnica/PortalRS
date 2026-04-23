using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidaturasJunction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente — tenants existentes podem já ter estado parcial.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Candidaturas" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "CandidatoId" uuid NOT NULL,
                    "VagaId" uuid NOT NULL,
                    "Status" smallint NOT NULL,
                    "EtapaMacro" smallint NOT NULL,
                    "Fonte" character varying(60) NULL,
                    "Observacoes" character varying(2000) NULL,
                    "AplicadaEmUtc" timestamp with time zone NOT NULL,
                    "EtapaAtualDesdeUtc" timestamp with time zone NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_Candidaturas" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "CandidaturaEtapaHistoricos" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "CandidaturaId" uuid NOT NULL,
                    "EtapaAnterior" smallint NOT NULL,
                    "EtapaNova" smallint NOT NULL,
                    "Observacao" character varying(2000) NULL,
                    "UserId" uuid NULL,
                    "EmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_CandidaturaEtapaHistoricos" PRIMARY KEY ("Id")
                );

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'FK_Candidaturas_Candidatos_CandidatoId'
                    ) THEN
                        ALTER TABLE "Candidaturas"
                        ADD CONSTRAINT "FK_Candidaturas_Candidatos_CandidatoId"
                        FOREIGN KEY ("CandidatoId") REFERENCES "Candidatos" ("Id") ON DELETE CASCADE;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'FK_Candidaturas_Vagas_VagaId'
                    ) THEN
                        ALTER TABLE "Candidaturas"
                        ADD CONSTRAINT "FK_Candidaturas_Vagas_VagaId"
                        FOREIGN KEY ("VagaId") REFERENCES "Vagas" ("Id") ON DELETE RESTRICT;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'FK_CandidaturaEtapaHistoricos_Candidaturas_CandidaturaId'
                    ) THEN
                        ALTER TABLE "CandidaturaEtapaHistoricos"
                        ADD CONSTRAINT "FK_CandidaturaEtapaHistoricos_Candidaturas_CandidaturaId"
                        FOREIGN KEY ("CandidaturaId") REFERENCES "Candidaturas" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_Candidaturas_CandidatoId" ON "Candidaturas" ("CandidatoId");
                CREATE INDEX IF NOT EXISTS "IX_Candidaturas_VagaId" ON "Candidaturas" ("VagaId");
                CREATE INDEX IF NOT EXISTS "IX_Candidaturas_TenantId_CandidatoId" ON "Candidaturas" ("TenantId", "CandidatoId");
                CREATE INDEX IF NOT EXISTS "IX_Candidaturas_TenantId_VagaId" ON "Candidaturas" ("TenantId", "VagaId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Candidaturas_TenantId_CandidatoId_VagaId" ON "Candidaturas" ("TenantId", "CandidatoId", "VagaId");

                CREATE INDEX IF NOT EXISTS "IX_CandidaturaEtapaHistoricos_CandidaturaId" ON "CandidaturaEtapaHistoricos" ("CandidaturaId");
                CREATE INDEX IF NOT EXISTS "IX_CandidaturaEtapaHistoricos_TenantId_CandidaturaId" ON "CandidaturaEtapaHistoricos" ("TenantId", "CandidaturaId");

                -- Backfill: converter Candidato.VagaId existente em registros de Candidatura,
                -- preservando o histórico que hoje está implícito no campo 1:1.
                INSERT INTO "Candidaturas" (
                    "Id", "TenantId", "CandidatoId", "VagaId", "Status", "EtapaMacro",
                    "Fonte", "Observacoes", "AplicadaEmUtc", "EtapaAtualDesdeUtc",
                    "CreatedAtUtc", "UpdatedAtUtc"
                )
                SELECT
                    gen_random_uuid(),
                    c."TenantId",
                    c."Id",
                    c."VagaId",
                    0,              -- CandidaturaStatus.Ativa
                    0,              -- EtapaMacroCandidatura.Aplicada
                    'Backfill',
                    NULL,
                    COALESCE(c."CreatedAtUtc", now()),
                    COALESCE(c."CreatedAtUtc", now()),
                    now(),
                    now()
                FROM "Candidatos" c
                WHERE c."VagaId" IS NOT NULL
                  AND NOT EXISTS (
                        SELECT 1 FROM "Candidaturas" k
                        WHERE k."CandidatoId" = c."Id" AND k."VagaId" = c."VagaId"
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "CandidaturaEtapaHistoricos";
                DROP TABLE IF EXISTS "Candidaturas";
                """);
        }
    }
}
