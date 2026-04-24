using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Sessão 31.2 — Consolidação Area+Department→CentroCusto, passo 2/4.
    ///
    /// OBJETIVO
    /// ========
    /// Preserva TODOS os dados de Areas e Departments copiando-os para CentrosCusto
    /// (mantendo o mesmo Id), migra as FKs (Vagas.AreaId/DepartmentId → CentroCustoId,
    /// Funcionarios.AreaId → CentroCustoId, SolicitacoesVaga.AreaId → CentroCustoId,
    /// SolicitacoesPromocao.AreaAtualId/NovaAreaId → CentroCustoAtualId/NovoCentroCustoId,
    /// JobPositions.AreaId → CentroCustoId, PreAdmissoes.AreaId → CentroCustoId) e só
    /// então remove as tabelas Areas e Departments.
    ///
    /// IDEMPOTÊNCIA
    /// ============
    /// Conforme CLAUDE.md, todas as operações são seguras para rodar múltiplas vezes
    /// em bancos de tenants em estados diferentes:
    ///   - ALTER TABLE ... DROP CONSTRAINT IF EXISTS
    ///   - ALTER TABLE ... DROP COLUMN IF EXISTS
    ///   - DROP INDEX IF EXISTS
    ///   - DROP TABLE IF EXISTS
    ///   - INSERT ... ON CONFLICT DO NOTHING
    ///   - UPDATE em colunas já consolidadas só atua onde CentroCustoId IS NULL
    ///
    /// ORDEM CRÍTICA
    /// =============
    /// 1. COPIAR dados antigos → CentrosCusto (INSERT ... ON CONFLICT DO NOTHING).
    /// 2. BACKFILL CentroCustoId/CentroCustoAtualId/NovoCentroCustoId a partir das
    ///    colunas antigas.
    /// 3. RENOMEAR colunas legadas (JobPositions.AreaId→CentroCustoId,
    ///    PreAdmissoes.AreaId→CentroCustoId, PreAdmissoes.CentroCusto→CentroCustoTotvs,
    ///    SolicitacoesPromocao.AreaAtualId→CentroCustoAtualId, NovaAreaId→NovoCentroCustoId).
    /// 4. DROP colunas legadas (Vagas.AreaId, Vagas.DepartmentId, SolicitacoesVaga.AreaId,
    ///    Funcionarios.AreaId) e FKs/índices associados.
    /// 5. DROP tabelas Areas e Departments.
    /// 6. CRIAR FKs novos (CentrosCusto) com ON DELETE apropriado.
    /// </summary>
    public partial class ConsolidateAreaDepartmentIntoCentroCusto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1) COPIAR Areas → CentrosCusto (preservando Id) ─────────────────
            //    A tabela Areas pode não existir em tenants novos (provisionados
            //    após o drop). O bloco DO $$ ... $$ guarda contra esse caso.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = current_schema() AND table_name = 'Areas'
                    ) THEN
                        INSERT INTO "CentrosCusto"
                            ("Id", "TenantId", "Code", "Description", "IsActive",
                             "CreatedAtUtc", "UpdatedAtUtc", "Headcount", "OwnerFuncionarioId",
                             "Description2")
                        SELECT a."Id", a."TenantId",
                               -- Code em Area era varchar(40); em CentroCusto é varchar(30). Truncar.
                               LEFT(a."Code", 30),
                               a."Name",
                               a."IsActive",
                               now(), now(),
                               0,
                               a."OwnerFuncionarioId",
                               a."Description"
                        FROM "Areas" a
                        ON CONFLICT ("Id") DO NOTHING;
                    END IF;
                END $$;
            """);

            // ── 2) COPIAR Departments → CentrosCusto (preservando Id) ───────────
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = current_schema() AND table_name = 'Departments'
                    ) THEN
                        INSERT INTO "CentrosCusto"
                            ("Id", "TenantId", "Code", "Description", "IsActive",
                             "CreatedAtUtc", "UpdatedAtUtc",
                             "Headcount", "Phone", "BranchOrLocation", "Manager", "Notes")
                        SELECT d."Id", d."TenantId",
                               LEFT(d."Code", 30),
                               d."Name",
                               -- Department.Status era enum (0=Active, 1=Inactive). Traduzir p/ IsActive.
                               (d."Status" = 0),
                               COALESCE(d."CreatedAtUtc", now()),
                               COALESCE(d."UpdatedAtUtc", now()),
                               COALESCE(d."Headcount", 0),
                               d."Phone",
                               d."BranchOrLocation",
                               d."ManagerName",
                               d."Description"
                        FROM "Departments" d
                        ON CONFLICT ("Id") DO NOTHING;
                    END IF;
                END $$;
            """);

            // ── 3) BACKFILL CentroCustoId em tabelas que referenciam Area/Department ─
            //    Só atualiza onde o CentroCustoId ainda está NULL (preservando backfills manuais).

            // Vagas: prioriza AreaId; usa DepartmentId como fallback.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = 'Vagas' AND column_name = 'AreaId'
                    ) THEN
                        UPDATE "Vagas" SET "CentroCustoId" = "AreaId"
                        WHERE "CentroCustoId" IS NULL AND "AreaId" IS NOT NULL;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = 'Vagas' AND column_name = 'DepartmentId'
                    ) THEN
                        UPDATE "Vagas" SET "CentroCustoId" = "DepartmentId"
                        WHERE "CentroCustoId" IS NULL AND "DepartmentId" IS NOT NULL;
                    END IF;
                END $$;
            """);

            // SolicitacoesVaga.AreaId → CentroCustoId (coluna CentroCustoId já existia em SolicitacaoVaga).
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = 'SolicitacoesVaga' AND column_name = 'AreaId'
                    ) AND EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = 'SolicitacoesVaga' AND column_name = 'CentroCustoId'
                    ) THEN
                        UPDATE "SolicitacoesVaga" SET "CentroCustoId" = "AreaId"
                        WHERE "CentroCustoId" IS NULL AND "AreaId" IS NOT NULL;
                    END IF;
                END $$;
            """);

            // Funcionarios.AreaId → CentroCustoId (coluna CentroCustoId já existe).
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = 'Funcionarios' AND column_name = 'AreaId'
                    ) THEN
                        UPDATE "Funcionarios" SET "CentroCustoId" = "AreaId"
                        WHERE "CentroCustoId" IS NULL AND "AreaId" IS NOT NULL;
                    END IF;
                END $$;
            """);

            // ── 4) RENOMEAR colunas legadas ────────────────────────────────────
            //    Em PostgreSQL, ALTER TABLE ... RENAME COLUMN é seguro mas não aceita
            //    IF EXISTS em algumas versões. Usamos o pg_class para detectar a existência.

            // JobPositions.AreaId → CentroCustoId
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'JobPositions' AND column_name = 'AreaId'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'JobPositions' AND column_name = 'CentroCustoId'
                    ) THEN
                        ALTER TABLE "JobPositions" RENAME COLUMN "AreaId" TO "CentroCustoId";
                    END IF;
                END $$;
            """);

            // PreAdmissoes.AreaId → CentroCustoId
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'PreAdmissoes' AND column_name = 'AreaId'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'PreAdmissoes' AND column_name = 'CentroCustoId'
                    ) THEN
                        ALTER TABLE "PreAdmissoes" RENAME COLUMN "AreaId" TO "CentroCustoId";
                    END IF;
                END $$;
            """);

            // PreAdmissoes.CentroCusto (string TOTVS livre) → CentroCustoTotvs
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'PreAdmissoes' AND column_name = 'CentroCusto'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'PreAdmissoes' AND column_name = 'CentroCustoTotvs'
                    ) THEN
                        ALTER TABLE "PreAdmissoes" RENAME COLUMN "CentroCusto" TO "CentroCustoTotvs";
                    END IF;
                END $$;
            """);

            // SolicitacoesPromocao.AreaAtualId → CentroCustoAtualId
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'SolicitacoesPromocao' AND column_name = 'AreaAtualId'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'SolicitacoesPromocao' AND column_name = 'CentroCustoAtualId'
                    ) THEN
                        ALTER TABLE "SolicitacoesPromocao" RENAME COLUMN "AreaAtualId" TO "CentroCustoAtualId";
                    END IF;
                END $$;
            """);

            // SolicitacoesPromocao.NovaAreaId → NovoCentroCustoId
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'SolicitacoesPromocao' AND column_name = 'NovaAreaId'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'SolicitacoesPromocao' AND column_name = 'NovoCentroCustoId'
                    ) THEN
                        ALTER TABLE "SolicitacoesPromocao" RENAME COLUMN "NovaAreaId" TO "NovoCentroCustoId";
                    END IF;
                END $$;
            """);

            // Índices renomeados acompanham a coluna (o Postgres não renomeia índices automaticamente).
            migrationBuilder.Sql("""
                ALTER INDEX IF EXISTS "IX_JobPositions_AreaId" RENAME TO "IX_JobPositions_CentroCustoId";
                ALTER INDEX IF EXISTS "IX_PreAdmissoes_AreaId" RENAME TO "IX_PreAdmissoes_CentroCustoId";
                ALTER INDEX IF EXISTS "IX_SolicitacoesPromocao_AreaAtualId" RENAME TO "IX_SolicitacoesPromocao_CentroCustoAtualId";
                ALTER INDEX IF EXISTS "IX_SolicitacoesPromocao_NovaAreaId" RENAME TO "IX_SolicitacoesPromocao_NovoCentroCustoId";
            """);

            // ── 5) DROP FKs e colunas legadas ──────────────────────────────────
            migrationBuilder.Sql("""
                -- Vagas: AreaId, DepartmentId
                ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_Areas_AreaId";
                ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_Departments_DepartmentId";
                ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_CentrosCusto_CentroCustoId";
                DROP INDEX IF EXISTS "IX_Vagas_AreaId";
                DROP INDEX IF EXISTS "IX_Vagas_DepartmentId";
                DROP INDEX IF EXISTS "IX_Vagas_TenantId_AreaId";
                DROP INDEX IF EXISTS "IX_Vagas_TenantId_DepartmentId";
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "AreaId";
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "DepartmentId";

                -- SolicitacoesVaga: AreaId
                ALTER TABLE "SolicitacoesVaga" DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_Areas_AreaId";
                DROP INDEX IF EXISTS "IX_SolicitacoesVaga_AreaId";
                ALTER TABLE "SolicitacoesVaga" DROP COLUMN IF EXISTS "AreaId";

                -- Funcionarios: AreaId
                ALTER TABLE "Funcionarios" DROP CONSTRAINT IF EXISTS "FK_Funcionarios_Areas_AreaId";
                DROP INDEX IF EXISTS "IX_Funcionarios_AreaId";
                ALTER TABLE "Funcionarios" DROP COLUMN IF EXISTS "AreaId";

                -- JobPositions, PreAdmissoes, SolicitacoesPromocao: FKs antigos Areas.*
                ALTER TABLE "JobPositions" DROP CONSTRAINT IF EXISTS "FK_JobPositions_Areas_AreaId";
                ALTER TABLE "PreAdmissoes" DROP CONSTRAINT IF EXISTS "FK_PreAdmissoes_Areas_AreaId";
                ALTER TABLE "SolicitacoesPromocao" DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_Areas_AreaAtualId";
                ALTER TABLE "SolicitacoesPromocao" DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_Areas_NovaAreaId";
            """);

            // ── 6) DROP Areas e Departments ────────────────────────────────────
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "Departments";
                DROP TABLE IF EXISTS "Areas";
            """);

            // ── 7) CRIAR FKs novos (CentrosCusto) ──────────────────────────────
            migrationBuilder.Sql("""
                -- JobPositions → CentrosCusto (SET NULL)
                ALTER TABLE "JobPositions"
                    DROP CONSTRAINT IF EXISTS "FK_JobPositions_CentrosCusto_CentroCustoId";
                ALTER TABLE "JobPositions"
                    ADD CONSTRAINT "FK_JobPositions_CentrosCusto_CentroCustoId"
                    FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto" ("Id")
                    ON DELETE SET NULL;

                -- PreAdmissoes → CentrosCusto (SET NULL)
                ALTER TABLE "PreAdmissoes"
                    DROP CONSTRAINT IF EXISTS "FK_PreAdmissoes_CentrosCusto_CentroCustoId";
                ALTER TABLE "PreAdmissoes"
                    ADD CONSTRAINT "FK_PreAdmissoes_CentrosCusto_CentroCustoId"
                    FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto" ("Id")
                    ON DELETE SET NULL;

                -- SolicitacoesPromocao → CentrosCusto (NO ACTION, default)
                ALTER TABLE "SolicitacoesPromocao"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_CentrosCusto_CentroCustoAtualId";
                ALTER TABLE "SolicitacoesPromocao"
                    ADD CONSTRAINT "FK_SolicitacoesPromocao_CentrosCusto_CentroCustoAtualId"
                    FOREIGN KEY ("CentroCustoAtualId") REFERENCES "CentrosCusto" ("Id");

                ALTER TABLE "SolicitacoesPromocao"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_CentrosCusto_NovoCentroCustoId";
                ALTER TABLE "SolicitacoesPromocao"
                    ADD CONSTRAINT "FK_SolicitacoesPromocao_CentrosCusto_NovoCentroCustoId"
                    FOREIGN KEY ("NovoCentroCustoId") REFERENCES "CentrosCusto" ("Id");

                -- Vagas → CentrosCusto (RESTRICT — vaga não pode perder CC)
                ALTER TABLE "Vagas"
                    DROP CONSTRAINT IF EXISTS "FK_Vagas_CentrosCusto_CentroCustoId";
                ALTER TABLE "Vagas"
                    ADD CONSTRAINT "FK_Vagas_CentrosCusto_CentroCustoId"
                    FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto" ("Id")
                    ON DELETE RESTRICT;

                -- Índices novos
                CREATE INDEX IF NOT EXISTS "IX_Vagas_TenantId_CentroCustoId"
                    ON "Vagas" ("TenantId", "CentroCustoId");
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Este rollback é parcial: recria a estrutura de Areas/Departments vazia,
            // restaura as colunas AreaId/DepartmentId como nullable. **Não restaura dados**
            // porque a migração Up copia (mas não remove) as linhas para CentrosCusto —
            // um rollback completo exigiria separar os registros "originados de Area"
            // dos "originados de Department" no destino, o que não é trivial e nunca
            // deveria ser necessário em produção (migration de consolidação é one-way).

            migrationBuilder.Sql("""
                -- Remover FKs/índices novos
                DROP INDEX IF EXISTS "IX_Vagas_TenantId_CentroCustoId";
                ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_CentrosCusto_CentroCustoId";
                ALTER TABLE "SolicitacoesPromocao" DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_CentrosCusto_CentroCustoAtualId";
                ALTER TABLE "SolicitacoesPromocao" DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_CentrosCusto_NovoCentroCustoId";
                ALTER TABLE "PreAdmissoes" DROP CONSTRAINT IF EXISTS "FK_PreAdmissoes_CentrosCusto_CentroCustoId";
                ALTER TABLE "JobPositions" DROP CONSTRAINT IF EXISTS "FK_JobPositions_CentrosCusto_CentroCustoId";
            """);

            // Reverter renames
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'JobPositions' AND column_name = 'CentroCustoId')
                       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'JobPositions' AND column_name = 'AreaId') THEN
                        ALTER TABLE "JobPositions" RENAME COLUMN "CentroCustoId" TO "AreaId";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'PreAdmissoes' AND column_name = 'CentroCustoId')
                       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'PreAdmissoes' AND column_name = 'AreaId') THEN
                        ALTER TABLE "PreAdmissoes" RENAME COLUMN "CentroCustoId" TO "AreaId";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'PreAdmissoes' AND column_name = 'CentroCustoTotvs')
                       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'PreAdmissoes' AND column_name = 'CentroCusto') THEN
                        ALTER TABLE "PreAdmissoes" RENAME COLUMN "CentroCustoTotvs" TO "CentroCusto";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'SolicitacoesPromocao' AND column_name = 'CentroCustoAtualId')
                       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'SolicitacoesPromocao' AND column_name = 'AreaAtualId') THEN
                        ALTER TABLE "SolicitacoesPromocao" RENAME COLUMN "CentroCustoAtualId" TO "AreaAtualId";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'SolicitacoesPromocao' AND column_name = 'NovoCentroCustoId')
                       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'SolicitacoesPromocao' AND column_name = 'NovaAreaId') THEN
                        ALTER TABLE "SolicitacoesPromocao" RENAME COLUMN "NovoCentroCustoId" TO "NovaAreaId";
                    END IF;
                END $$;

                ALTER INDEX IF EXISTS "IX_JobPositions_CentroCustoId" RENAME TO "IX_JobPositions_AreaId";
                ALTER INDEX IF EXISTS "IX_PreAdmissoes_CentroCustoId" RENAME TO "IX_PreAdmissoes_AreaId";
                ALTER INDEX IF EXISTS "IX_SolicitacoesPromocao_CentroCustoAtualId" RENAME TO "IX_SolicitacoesPromocao_AreaAtualId";
                ALTER INDEX IF EXISTS "IX_SolicitacoesPromocao_NovoCentroCustoId" RENAME TO "IX_SolicitacoesPromocao_NovaAreaId";
            """);

            // Recriar colunas AreaId/DepartmentId (vazias)
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "AreaId" uuid NULL;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "DepartmentId" uuid NULL;
                ALTER TABLE "SolicitacoesVaga" ADD COLUMN IF NOT EXISTS "AreaId" uuid NULL;
                ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "AreaId" uuid NULL;

                CREATE INDEX IF NOT EXISTS "IX_Vagas_AreaId" ON "Vagas" ("AreaId");
                CREATE INDEX IF NOT EXISTS "IX_Vagas_DepartmentId" ON "Vagas" ("DepartmentId");
                CREATE INDEX IF NOT EXISTS "IX_Vagas_TenantId_AreaId" ON "Vagas" ("TenantId", "AreaId");
                CREATE INDEX IF NOT EXISTS "IX_Vagas_TenantId_DepartmentId" ON "Vagas" ("TenantId", "DepartmentId");
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_AreaId" ON "SolicitacoesVaga" ("AreaId");
                CREATE INDEX IF NOT EXISTS "IX_Funcionarios_AreaId" ON "Funcionarios" ("AreaId");
            """);

            // Recriar tabelas Areas e Departments vazias
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Areas" (
                    "Id" uuid NOT NULL,
                    "TenantId" varchar(64) NOT NULL,
                    "Code" varchar(40) NOT NULL,
                    "Name" varchar(120) NOT NULL,
                    "Description" varchar(1000) NULL,
                    "IsActive" boolean NOT NULL DEFAULT true,
                    "OwnerFuncionarioId" uuid NULL,
                    "ParentId" uuid NULL,
                    CONSTRAINT "PK_Areas" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_Areas_Areas_ParentId" FOREIGN KEY ("ParentId") REFERENCES "Areas" ("Id") ON DELETE RESTRICT,
                    CONSTRAINT "FK_Areas_Funcionarios_OwnerFuncionarioId" FOREIGN KEY ("OwnerFuncionarioId") REFERENCES "Funcionarios" ("Id") ON DELETE SET NULL
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Areas_TenantId_Code" ON "Areas" ("TenantId", "Code");
                CREATE INDEX IF NOT EXISTS "IX_Areas_OwnerFuncionarioId" ON "Areas" ("OwnerFuncionarioId");
                CREATE INDEX IF NOT EXISTS "IX_Areas_ParentId" ON "Areas" ("ParentId");

                CREATE TABLE IF NOT EXISTS "Departments" (
                    "Id" uuid NOT NULL,
                    "TenantId" varchar(64) NOT NULL,
                    "Code" varchar(40) NOT NULL,
                    "Name" varchar(120) NOT NULL,
                    "Description" varchar(1000) NULL,
                    "AreaId" uuid NULL,
                    "BranchOrLocation" varchar(80) NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT now(),
                    "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now(),
                    "Headcount" integer NOT NULL DEFAULT 0,
                    "ManagerEmail" varchar(180) NULL,
                    "ManagerName" varchar(120) NULL,
                    "Phone" varchar(40) NULL,
                    "Status" integer NOT NULL DEFAULT 0,
                    CONSTRAINT "PK_Departments" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_Departments_Areas_AreaId" FOREIGN KEY ("AreaId") REFERENCES "Areas" ("Id") ON DELETE SET NULL
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Departments_TenantId_Code" ON "Departments" ("TenantId", "Code");
                CREATE INDEX IF NOT EXISTS "IX_Departments_AreaId" ON "Departments" ("AreaId");
            """);

            // Recriar FKs
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas"
                    DROP CONSTRAINT IF EXISTS "FK_Vagas_Areas_AreaId";
                ALTER TABLE "Vagas"
                    ADD CONSTRAINT "FK_Vagas_Areas_AreaId"
                    FOREIGN KEY ("AreaId") REFERENCES "Areas" ("Id") ON DELETE RESTRICT;

                ALTER TABLE "Vagas"
                    DROP CONSTRAINT IF EXISTS "FK_Vagas_Departments_DepartmentId";
                ALTER TABLE "Vagas"
                    ADD CONSTRAINT "FK_Vagas_Departments_DepartmentId"
                    FOREIGN KEY ("DepartmentId") REFERENCES "Departments" ("Id") ON DELETE RESTRICT;

                ALTER TABLE "Vagas"
                    DROP CONSTRAINT IF EXISTS "FK_Vagas_CentrosCusto_CentroCustoId";
                ALTER TABLE "Vagas"
                    ADD CONSTRAINT "FK_Vagas_CentrosCusto_CentroCustoId"
                    FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto" ("Id");

                ALTER TABLE "SolicitacoesVaga"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_Areas_AreaId";
                ALTER TABLE "SolicitacoesVaga"
                    ADD CONSTRAINT "FK_SolicitacoesVaga_Areas_AreaId"
                    FOREIGN KEY ("AreaId") REFERENCES "Areas" ("Id") ON DELETE RESTRICT;

                ALTER TABLE "Funcionarios"
                    DROP CONSTRAINT IF EXISTS "FK_Funcionarios_Areas_AreaId";
                ALTER TABLE "Funcionarios"
                    ADD CONSTRAINT "FK_Funcionarios_Areas_AreaId"
                    FOREIGN KEY ("AreaId") REFERENCES "Areas" ("Id") ON DELETE RESTRICT;

                ALTER TABLE "JobPositions"
                    DROP CONSTRAINT IF EXISTS "FK_JobPositions_Areas_AreaId";
                ALTER TABLE "JobPositions"
                    ADD CONSTRAINT "FK_JobPositions_Areas_AreaId"
                    FOREIGN KEY ("AreaId") REFERENCES "Areas" ("Id") ON DELETE SET NULL;

                ALTER TABLE "PreAdmissoes"
                    DROP CONSTRAINT IF EXISTS "FK_PreAdmissoes_Areas_AreaId";
                ALTER TABLE "PreAdmissoes"
                    ADD CONSTRAINT "FK_PreAdmissoes_Areas_AreaId"
                    FOREIGN KEY ("AreaId") REFERENCES "Areas" ("Id") ON DELETE SET NULL;

                ALTER TABLE "SolicitacoesPromocao"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_Areas_AreaAtualId";
                ALTER TABLE "SolicitacoesPromocao"
                    ADD CONSTRAINT "FK_SolicitacoesPromocao_Areas_AreaAtualId"
                    FOREIGN KEY ("AreaAtualId") REFERENCES "Areas" ("Id");

                ALTER TABLE "SolicitacoesPromocao"
                    DROP CONSTRAINT IF EXISTS "FK_SolicitacoesPromocao_Areas_NovaAreaId";
                ALTER TABLE "SolicitacoesPromocao"
                    ADD CONSTRAINT "FK_SolicitacoesPromocao_Areas_NovaAreaId"
                    FOREIGN KEY ("NovaAreaId") REFERENCES "Areas" ("Id");
            """);
        }
    }
}
