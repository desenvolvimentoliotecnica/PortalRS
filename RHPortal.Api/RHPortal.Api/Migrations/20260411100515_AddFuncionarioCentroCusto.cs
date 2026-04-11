using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFuncionarioCentroCusto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // All statements use IF NOT EXISTS / DO blocks to be fully idempotent.
            // Tables, columns and indexes may already exist from a previously applied migration.
            migrationBuilder.Sql("""
                -- Aprovador3 columns on SolicitacoesVaga
                ALTER TABLE "SolicitacoesVaga"
                    ADD COLUMN IF NOT EXISTS "Aprovador3DataUtc"    timestamptz  NULL,
                    ADD COLUMN IF NOT EXISTS "Aprovador3Habilitado" boolean      NOT NULL DEFAULT false,
                    ADD COLUMN IF NOT EXISTS "Aprovador3Id"         uuid         NULL,
                    ADD COLUMN IF NOT EXISTS "Aprovador3Status"     smallint     NULL;

                -- Roles.Tipo default
                ALTER TABLE "Roles" ALTER COLUMN "Tipo" SET DEFAULT 1;

                -- Funcionarios.CentroCustoId
                ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "CentroCustoId" uuid NULL;

                -- EtapasConfigAprovacao
                CREATE TABLE IF NOT EXISTS "EtapasConfigAprovacao" (
                    "Id"               uuid                        NOT NULL,
                    "TenantId"         character varying(64)       NOT NULL,
                    "TipoFluxo"        smallint                    NOT NULL,
                    "Ordem"            integer                     NOT NULL,
                    "Label"            character varying(120)      NOT NULL,
                    "TipoAprovador"    smallint                    NOT NULL,
                    "FuncionarioFixoId" uuid,
                    "RoleFilaId"       uuid,
                    "Ativo"            boolean                     NOT NULL,
                    "UpdatedAtUtc"     timestamp with time zone    NOT NULL,
                    CONSTRAINT "PK_EtapasConfigAprovacao" PRIMARY KEY ("Id")
                );
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_EtapasConfigAprovacao_Funcionarios_FuncionarioFixoId') THEN
                        ALTER TABLE "EtapasConfigAprovacao" ADD CONSTRAINT "FK_EtapasConfigAprovacao_Funcionarios_FuncionarioFixoId"
                            FOREIGN KEY ("FuncionarioFixoId") REFERENCES "Funcionarios" ("Id") ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_EtapasConfigAprovacao_Roles_RoleFilaId') THEN
                        ALTER TABLE "EtapasConfigAprovacao" ADD CONSTRAINT "FK_EtapasConfigAprovacao_Roles_RoleFilaId"
                            FOREIGN KEY ("RoleFilaId") REFERENCES "Roles" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;

                -- SolicitacoesAprovacaoEtapas
                CREATE TABLE IF NOT EXISTS "SolicitacoesAprovacaoEtapas" (
                    "Id"            uuid                        NOT NULL,
                    "TenantId"      character varying(64)       NOT NULL,
                    "SolicitacaoId" uuid                        NOT NULL,
                    "TipoFluxo"     smallint                    NOT NULL,
                    "Ordem"         integer                     NOT NULL,
                    "Label"         character varying(120)      NOT NULL,
                    "AprovadorId"   uuid,
                    "RoleFilaId"    uuid,
                    "Status"        smallint                    NOT NULL,
                    "Observacao"    text,
                    "DataUtc"       timestamp with time zone,
                    CONSTRAINT "PK_SolicitacoesAprovacaoEtapas" PRIMARY KEY ("Id")
                );
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SolicitacoesAprovacaoEtapas_Funcionarios_AprovadorId') THEN
                        ALTER TABLE "SolicitacoesAprovacaoEtapas" ADD CONSTRAINT "FK_SolicitacoesAprovacaoEtapas_Funcionarios_AprovadorId"
                            FOREIGN KEY ("AprovadorId") REFERENCES "Funcionarios" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;

                -- TenantConfiguracoes
                CREATE TABLE IF NOT EXISTS "TenantConfiguracoes" (
                    "Id"                      uuid                        NOT NULL,
                    "TenantId"                character varying(64)       NOT NULL,
                    "RhDeveAprovarAposGestor" boolean                     NOT NULL,
                    "AprovadorRhId"           uuid,
                    "UpdatedAtUtc"            timestamp with time zone    NOT NULL,
                    CONSTRAINT "PK_TenantConfiguracoes" PRIMARY KEY ("Id")
                );
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_TenantConfiguracoes_Funcionarios_AprovadorRhId') THEN
                        ALTER TABLE "TenantConfiguracoes" ADD CONSTRAINT "FK_TenantConfiguracoes_Funcionarios_AprovadorRhId"
                            FOREIGN KEY ("AprovadorRhId") REFERENCES "Funcionarios" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;

                -- Indexes
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_Aprovador3Id"
                    ON "SolicitacoesVaga" ("Aprovador3Id");
                CREATE INDEX IF NOT EXISTS "IX_Funcionarios_CentroCustoId"
                    ON "Funcionarios" ("CentroCustoId");
                CREATE INDEX IF NOT EXISTS "IX_EtapasConfigAprovacao_FuncionarioFixoId"
                    ON "EtapasConfigAprovacao" ("FuncionarioFixoId");
                CREATE INDEX IF NOT EXISTS "IX_EtapasConfigAprovacao_RoleFilaId"
                    ON "EtapasConfigAprovacao" ("RoleFilaId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_EtapasConfigAprovacao_TenantId_TipoFluxo_Ordem"
                    ON "EtapasConfigAprovacao" ("TenantId", "TipoFluxo", "Ordem");
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesAprovacaoEtapas_AprovadorId"
                    ON "SolicitacoesAprovacaoEtapas" ("AprovadorId");
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesAprovacaoEtapas_TenantId_RoleFilaId_Status"
                    ON "SolicitacoesAprovacaoEtapas" ("TenantId", "RoleFilaId", "Status")
                    WHERE "RoleFilaId" IS NOT NULL;
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesAprovacaoEtapas_TenantId_SolicitacaoId_TipoFluxo"
                    ON "SolicitacoesAprovacaoEtapas" ("TenantId", "SolicitacaoId", "TipoFluxo");
                CREATE INDEX IF NOT EXISTS "IX_TenantConfiguracoes_AprovadorRhId"
                    ON "TenantConfiguracoes" ("AprovadorRhId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantConfiguracoes_TenantId"
                    ON "TenantConfiguracoes" ("TenantId");

                -- Foreign keys on existing tables
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Funcionarios_CentrosCusto_CentroCustoId') THEN
                        ALTER TABLE "Funcionarios" ADD CONSTRAINT "FK_Funcionarios_CentrosCusto_CentroCustoId"
                            FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto" ("Id");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SolicitacoesVaga_Funcionarios_Aprovador3Id') THEN
                        ALTER TABLE "SolicitacoesVaga" ADD CONSTRAINT "FK_SolicitacoesVaga_Funcionarios_Aprovador3Id"
                            FOREIGN KEY ("Aprovador3Id") REFERENCES "Funcionarios" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Funcionarios"     DROP CONSTRAINT IF EXISTS "FK_Funcionarios_CentrosCusto_CentroCustoId";
                ALTER TABLE "SolicitacoesVaga" DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_Funcionarios_Aprovador3Id";

                DROP TABLE IF EXISTS "EtapasConfigAprovacao";
                DROP TABLE IF EXISTS "SolicitacoesAprovacaoEtapas";
                DROP TABLE IF EXISTS "TenantConfiguracoes";

                DROP INDEX IF EXISTS "IX_SolicitacoesVaga_Aprovador3Id";
                DROP INDEX IF EXISTS "IX_Funcionarios_CentroCustoId";

                ALTER TABLE "SolicitacoesVaga"
                    DROP COLUMN IF EXISTS "Aprovador3DataUtc",
                    DROP COLUMN IF EXISTS "Aprovador3Habilitado",
                    DROP COLUMN IF EXISTS "Aprovador3Id",
                    DROP COLUMN IF EXISTS "Aprovador3Status";

                ALTER TABLE "Funcionarios" DROP COLUMN IF EXISTS "CentroCustoId";

                ALTER TABLE "Roles" ALTER COLUMN "Tipo" DROP DEFAULT;
                """);
        }
    }
}
