using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Fase 4.R — cria a tabela <c>CandidatoVagaLlmScores</c> que cacheia resultados
    /// do LLM-as-Judge (Qwen 2.5). Idempotente — pode rodar N vezes em tenants existentes.
    /// </summary>
    public partial class AddCandidatoVagaLlmScore : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "CandidatoVagaLlmScores" (
                    "Id"                  uuid                     NOT NULL,
                    "TenantId"            character varying(64)    NOT NULL,
                    "CandidatoId"         uuid                     NOT NULL,
                    "VagaId"              uuid                     NOT NULL,
                    "ScoreFinal"          integer                  NOT NULL DEFAULT 0,
                    "PassouMatchMinimo"   boolean                  NOT NULL DEFAULT false,
                    "JustificativaTexto"  character varying(4000)  NOT NULL DEFAULT '',
                    "CriteriosJson"       jsonb                    NOT NULL DEFAULT '[]'::jsonb,
                    "PontosFortes"        character varying(2000)  NULL,
                    "Gaps"                character varying(2000)  NULL,
                    "InputHash"           character varying(64)    NOT NULL,
                    "ModelVersion"        character varying(60)    NOT NULL,
                    "DurationMs"          integer                  NOT NULL DEFAULT 0,
                    "CreatedAtUtc"        timestamp with time zone NOT NULL,
                    "UpdatedAtUtc"        timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_CandidatoVagaLlmScores" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CandidatoVagaLlmScores_Candidato') THEN
                        ALTER TABLE "CandidatoVagaLlmScores"
                            ADD CONSTRAINT "FK_CandidatoVagaLlmScores_Candidato"
                            FOREIGN KEY ("CandidatoId") REFERENCES "Candidatos"("Id") ON DELETE CASCADE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CandidatoVagaLlmScores_Vaga') THEN
                        ALTER TABLE "CandidatoVagaLlmScores"
                            ADD CONSTRAINT "FK_CandidatoVagaLlmScores_Vaga"
                            FOREIGN KEY ("VagaId") REFERENCES "Vagas"("Id") ON DELETE CASCADE;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CandidatoVagaLlmScores_Tenant_Vaga_Candidato"
                    ON "CandidatoVagaLlmScores" ("TenantId", "VagaId", "CandidatoId");
                CREATE INDEX IF NOT EXISTS "IX_CandidatoVagaLlmScores_TenantId"
                    ON "CandidatoVagaLlmScores" ("TenantId");
                CREATE INDEX IF NOT EXISTS "IX_CandidatoVagaLlmScores_Candidato"
                    ON "CandidatoVagaLlmScores" ("CandidatoId");
                CREATE INDEX IF NOT EXISTS "IX_CandidatoVagaLlmScores_Vaga"
                    ON "CandidatoVagaLlmScores" ("VagaId");
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "CandidatoVagaLlmScores";""");
        }
    }
}
