using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAvaliacaoConvocacoesECalibragem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "NineBoxAssessments" ADD COLUMN IF NOT EXISTS "CicloAvaliacaoId" uuid NULL;

                CREATE TABLE IF NOT EXISTS "AvaliacaoConvites" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "CicloId" uuid NOT NULL,
                    "AvaliadorId" uuid NOT NULL,
                    "AvaliandoId" uuid NOT NULL,
                    "Tipo" smallint NOT NULL,
                    "Status" smallint NOT NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    "NotificadoEmUtc" timestamp with time zone NULL,
                    "RespondidoEmUtc" timestamp with time zone NULL,
                    CONSTRAINT "PK_AvaliacaoConvites" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "AvaliacaoCalibragens" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "CicloId" uuid NOT NULL,
                    "FuncionarioId" uuid NOT NULL,
                    "ScoreGestor" numeric(5,2) NOT NULL,
                    "DesempenhoGestor" integer NULL,
                    "PotencialGestor" integer NULL,
                    "ScoreComite" numeric(5,2) NULL,
                    "DesempenhoComite" integer NULL,
                    "PotencialComite" integer NULL,
                    "JustificativaComite" character varying(2000) NULL,
                    "Status" smallint NOT NULL,
                    "Decisao" smallint NOT NULL,
                    "DecididoPorUserId" uuid NULL,
                    "DecididoEmUtc" timestamp with time zone NULL,
                    "ObservacaoDecisao" character varying(2000) NULL,
                    "NineBoxAssessmentId" uuid NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    "AtualizadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_AvaliacaoCalibragens" PRIMARY KEY ("Id")
                );

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_NineBoxAssessments_AvaliacaoCiclos_CicloAvaliacaoId') THEN
                        ALTER TABLE "NineBoxAssessments"
                            ADD CONSTRAINT "FK_NineBoxAssessments_AvaliacaoCiclos_CicloAvaliacaoId"
                            FOREIGN KEY ("CicloAvaliacaoId") REFERENCES "AvaliacaoCiclos" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AvaliacaoConvites_AvaliacaoCiclos_CicloId') THEN
                        ALTER TABLE "AvaliacaoConvites"
                            ADD CONSTRAINT "FK_AvaliacaoConvites_AvaliacaoCiclos_CicloId"
                            FOREIGN KEY ("CicloId") REFERENCES "AvaliacaoCiclos" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AvaliacaoConvites_Funcionarios_AvaliadorId') THEN
                        ALTER TABLE "AvaliacaoConvites"
                            ADD CONSTRAINT "FK_AvaliacaoConvites_Funcionarios_AvaliadorId"
                            FOREIGN KEY ("AvaliadorId") REFERENCES "Funcionarios" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AvaliacaoConvites_Funcionarios_AvaliandoId') THEN
                        ALTER TABLE "AvaliacaoConvites"
                            ADD CONSTRAINT "FK_AvaliacaoConvites_Funcionarios_AvaliandoId"
                            FOREIGN KEY ("AvaliandoId") REFERENCES "Funcionarios" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AvaliacaoCalibragens_AvaliacaoCiclos_CicloId') THEN
                        ALTER TABLE "AvaliacaoCalibragens"
                            ADD CONSTRAINT "FK_AvaliacaoCalibragens_AvaliacaoCiclos_CicloId"
                            FOREIGN KEY ("CicloId") REFERENCES "AvaliacaoCiclos" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AvaliacaoCalibragens_Funcionarios_FuncionarioId') THEN
                        ALTER TABLE "AvaliacaoCalibragens"
                            ADD CONSTRAINT "FK_AvaliacaoCalibragens_Funcionarios_FuncionarioId"
                            FOREIGN KEY ("FuncionarioId") REFERENCES "Funcionarios" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AvaliacaoCalibragens_NineBoxAssessments_NineBoxAssessmentId') THEN
                        ALTER TABLE "AvaliacaoCalibragens"
                            ADD CONSTRAINT "FK_AvaliacaoCalibragens_NineBoxAssessments_NineBoxAssessmentId"
                            FOREIGN KEY ("NineBoxAssessmentId") REFERENCES "NineBoxAssessments" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_NineBoxAssessments_CicloAvaliacaoId"
                    ON "NineBoxAssessments" ("CicloAvaliacaoId");
                CREATE INDEX IF NOT EXISTS "IX_NineBoxAssessments_TenantId_CicloAvaliacaoId"
                    ON "NineBoxAssessments" ("TenantId", "CicloAvaliacaoId");

                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoConvites_AvaliadorId"
                    ON "AvaliacaoConvites" ("AvaliadorId");
                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoConvites_AvaliandoId"
                    ON "AvaliacaoConvites" ("AvaliandoId");
                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoConvites_CicloId"
                    ON "AvaliacaoConvites" ("CicloId");
                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoConvites_TenantId_AvaliadorId_Status"
                    ON "AvaliacaoConvites" ("TenantId", "AvaliadorId", "Status");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_AvaliacaoConvites_TenantId_CicloId_AvaliadorId_AvaliandoId"
                    ON "AvaliacaoConvites" ("TenantId", "CicloId", "AvaliadorId", "AvaliandoId");
                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoConvites_TenantId_CicloId_Status"
                    ON "AvaliacaoConvites" ("TenantId", "CicloId", "Status");

                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoCalibragens_CicloId"
                    ON "AvaliacaoCalibragens" ("CicloId");
                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoCalibragens_FuncionarioId"
                    ON "AvaliacaoCalibragens" ("FuncionarioId");
                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoCalibragens_NineBoxAssessmentId"
                    ON "AvaliacaoCalibragens" ("NineBoxAssessmentId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_AvaliacaoCalibragens_TenantId_CicloId_FuncionarioId"
                    ON "AvaliacaoCalibragens" ("TenantId", "CicloId", "FuncionarioId");
                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoCalibragens_TenantId_CicloId_Status"
                    ON "AvaliacaoCalibragens" ("TenantId", "CicloId", "Status");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "NineBoxAssessments" DROP CONSTRAINT IF EXISTS "FK_NineBoxAssessments_AvaliacaoCiclos_CicloAvaliacaoId";
                DROP TABLE IF EXISTS "AvaliacaoCalibragens";
                DROP TABLE IF EXISTS "AvaliacaoConvites";
                DROP INDEX IF EXISTS "IX_NineBoxAssessments_CicloAvaliacaoId";
                DROP INDEX IF EXISTS "IX_NineBoxAssessments_TenantId_CicloAvaliacaoId";
                ALTER TABLE "NineBoxAssessments" DROP COLUMN IF EXISTS "CicloAvaliacaoId";
                """);
        }
    }
}
