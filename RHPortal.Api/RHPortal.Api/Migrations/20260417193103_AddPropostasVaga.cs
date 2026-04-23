using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPropostasVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente — tenants existentes podem já ter algum estado parcial.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "PropostasVaga" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "VagaId" uuid NOT NULL,
                    "CandidatoId" uuid NOT NULL,
                    "Status" smallint NOT NULL,
                    "Moeda" character varying(3) NULL,
                    "SalarioOferecido" numeric(18,2) NULL,
                    "DescricaoBeneficios" character varying(2000) NULL,
                    "DataPrevistaInicio" date NULL,
                    "MensagemPersonalizada" character varying(8000) NULL,
                    "AccessToken" character varying(64) NULL,
                    "EnviadaEmUtc" timestamp with time zone NULL,
                    "ExpiraEmUtc" timestamp with time zone NULL,
                    "VisualizadaEmUtc" timestamp with time zone NULL,
                    "RespondidaEmUtc" timestamp with time zone NULL,
                    "NomeConfirmadoCandidato" character varying(160) NULL,
                    "IpOrigemResposta" character varying(60) NULL,
                    "UserAgentResposta" character varying(400) NULL,
                    "MotivoRecusa" character varying(2000) NULL,
                    "CriadaPorUserId" uuid NULL,
                    "EnviadaPorUserId" uuid NULL,
                    "ObservacaoInternaRh" character varying(500) NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_PropostasVaga" PRIMARY KEY ("Id")
                );

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'FK_PropostasVaga_Candidatos_CandidatoId'
                    ) THEN
                        ALTER TABLE "PropostasVaga"
                        ADD CONSTRAINT "FK_PropostasVaga_Candidatos_CandidatoId"
                        FOREIGN KEY ("CandidatoId") REFERENCES "Candidatos" ("Id") ON DELETE RESTRICT;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'FK_PropostasVaga_Vagas_VagaId'
                    ) THEN
                        ALTER TABLE "PropostasVaga"
                        ADD CONSTRAINT "FK_PropostasVaga_Vagas_VagaId"
                        FOREIGN KEY ("VagaId") REFERENCES "Vagas" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_PropostasVaga_AccessToken" ON "PropostasVaga" ("AccessToken");
                CREATE INDEX IF NOT EXISTS "IX_PropostasVaga_CandidatoId" ON "PropostasVaga" ("CandidatoId");
                CREATE INDEX IF NOT EXISTS "IX_PropostasVaga_TenantId_CandidatoId" ON "PropostasVaga" ("TenantId", "CandidatoId");
                CREATE INDEX IF NOT EXISTS "IX_PropostasVaga_TenantId_VagaId" ON "PropostasVaga" ("TenantId", "VagaId");
                CREATE INDEX IF NOT EXISTS "IX_PropostasVaga_VagaId" ON "PropostasVaga" ("VagaId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "PropostasVaga";
                """);
        }
    }
}
