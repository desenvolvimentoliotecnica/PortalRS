using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Sessão 31.2 — Consolidação Area+Department→CentroCusto, passo 1/4.
    ///
    /// 1) Cria tabela TenantBrandings (branding por tenant — nome/cores/logo do portal).
    /// 2) Estende CentroCusto com campos absorvidos de Area/Department:
    ///    - Headcount (int)
    ///    - Phone (varchar 40)
    ///    - BranchOrLocation (varchar 160)
    ///    - OwnerFuncionarioId (uuid, FK Funcionarios.Id SET NULL)
    ///    - Description2 (varchar 1000)
    ///
    /// Idempotência: todas operações seguem CLAUDE.md (ADD COLUMN IF NOT EXISTS,
    /// CREATE INDEX IF NOT EXISTS, DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT)
    /// para poderem ser aplicadas repetidamente em bancos de tenants em estados diferentes.
    /// </summary>
    public partial class AddTenantBrandingsAndExtendCentroCustoFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1) TenantBrandings ───────────────────────────────────────────
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "TenantBrandings" (
                    "Id" uuid NOT NULL,
                    "TenantId" varchar(64) NOT NULL,
                    "NomePortal" varchar(80) NULL,
                    "Subtitulo" varchar(160) NULL,
                    "RodapeTexto" varchar(160) NULL,
                    "CorPrimariaHex" varchar(7) NULL,
                    "CorSecundariaHex" varchar(7) NULL,
                    "LogoUrl" varchar(512) NULL,
                    "VersaoExibida" varchar(32) NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_TenantBrandings" PRIMARY KEY ("Id")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantBrandings_TenantId"
                    ON "TenantBrandings" ("TenantId");
            """);

            // ── 2) CentroCusto: campos absorvidos de Area/Department ─────────
            migrationBuilder.Sql("""
                ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "BranchOrLocation" varchar(160) NULL;
                ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "Description2" varchar(1000) NULL;
                ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "Headcount" integer NOT NULL DEFAULT 0;
                ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "OwnerFuncionarioId" uuid NULL;
                ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "Phone" varchar(40) NULL;
            """);

            // ── 3) Índice e FK para OwnerFuncionarioId ───────────────────────
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_CentrosCusto_OwnerFuncionarioId"
                    ON "CentrosCusto" ("OwnerFuncionarioId");

                ALTER TABLE "CentrosCusto"
                    DROP CONSTRAINT IF EXISTS "FK_CentrosCusto_Funcionarios_OwnerFuncionarioId";
                ALTER TABLE "CentrosCusto"
                    ADD CONSTRAINT "FK_CentrosCusto_Funcionarios_OwnerFuncionarioId"
                    FOREIGN KEY ("OwnerFuncionarioId") REFERENCES "Funcionarios" ("Id") ON DELETE SET NULL;
            """);

            // ── 4) Funcionarios.CentroCustoId: recriar FK com SET NULL ───────
            //    (antes era default NO ACTION; agora SET NULL para coexistir
            //     com o novo pareamento Funcionario.CentroCusto ↔ CentroCusto.Funcionarios.)
            migrationBuilder.Sql("""
                ALTER TABLE "Funcionarios"
                    DROP CONSTRAINT IF EXISTS "FK_Funcionarios_CentrosCusto_CentroCustoId";
                ALTER TABLE "Funcionarios"
                    ADD CONSTRAINT "FK_Funcionarios_CentrosCusto_CentroCustoId"
                    FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto" ("Id") ON DELETE SET NULL;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Funcionarios"
                    DROP CONSTRAINT IF EXISTS "FK_Funcionarios_CentrosCusto_CentroCustoId";
                ALTER TABLE "CentrosCusto"
                    DROP CONSTRAINT IF EXISTS "FK_CentrosCusto_Funcionarios_OwnerFuncionarioId";
                DROP INDEX IF EXISTS "IX_CentrosCusto_OwnerFuncionarioId";

                ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "BranchOrLocation";
                ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "Description2";
                ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "Headcount";
                ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "OwnerFuncionarioId";
                ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "Phone";

                DROP INDEX IF EXISTS "IX_TenantBrandings_TenantId";
                DROP TABLE IF EXISTS "TenantBrandings";

                ALTER TABLE "Funcionarios"
                    ADD CONSTRAINT "FK_Funcionarios_CentrosCusto_CentroCustoId"
                    FOREIGN KEY ("CentroCustoId") REFERENCES "CentrosCusto" ("Id");
            """);
        }
    }
}
