using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Adiciona <c>ValorBase</c> em <c>CategoriasSalariais</c> e cria a tabela
    /// <c>CategoriaSalarialSteps</c> (grade percentual por categoria: 80%, 85%, …, 120%).
    ///
    /// Usuário: "Categoria salarial aqui é o cargo o grid percentual que ele corre,
    /// exemplo, 80% x valor, 85% Y valor até 120% de grid salarial (aberto podendo
    /// deixar livre para cadastro)".
    ///
    /// Migration idempotente — <c>ADD COLUMN IF NOT EXISTS</c>, <c>CREATE TABLE IF
    /// NOT EXISTS</c>, <c>CREATE INDEX IF NOT EXISTS</c>, <c>DO $$ IF NOT EXISTS
    /// pg_constraint $$</c> para o FK. Permite re-execução em tenants em diferentes
    /// estágios sem crash.
    /// </summary>
    public partial class AddCategoriaSalarialValorBaseEGradePercentual : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Adiciona ValorBase em CategoriasSalariais
            migrationBuilder.Sql("""
                ALTER TABLE "CategoriasSalariais"
                    ADD COLUMN IF NOT EXISTS "ValorBase" numeric(18,2) NULL;
                """);

            // 2. Cria tabela CategoriaSalarialSteps (sem FK — adicionada em 3 num bloco separado)
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "CategoriaSalarialSteps" (
                    "Id"                  uuid                      NOT NULL,
                    "TenantId"            character varying(64)     NOT NULL,
                    "CategoriaSalarialId" uuid                      NOT NULL,
                    "Percentual"          numeric(8,2)              NOT NULL,
                    "ValorOverride"       numeric(18,2)             NULL,
                    "Ordem"               integer                   NOT NULL DEFAULT 0,
                    "Observacao"          character varying(200)    NULL,
                    "CreatedAtUtc"        timestamp with time zone  NOT NULL DEFAULT NOW(),
                    "UpdatedAtUtc"        timestamp with time zone  NOT NULL DEFAULT NOW(),
                    CONSTRAINT "PK_CategoriaSalarialSteps" PRIMARY KEY ("Id")
                );
                CREATE INDEX IF NOT EXISTS "IX_CategoriaSalarialSteps_CategoriaSalarialId"
                    ON "CategoriaSalarialSteps" ("CategoriaSalarialId");
                CREATE INDEX IF NOT EXISTS "IX_CategoriaSalarialSteps_TenantId_CategoriaSalarialId"
                    ON "CategoriaSalarialSteps" ("TenantId", "CategoriaSalarialId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CategoriaSalarialSteps_TenantId_CategoriaSalarialId_Percentual"
                    ON "CategoriaSalarialSteps" ("TenantId", "CategoriaSalarialId", "Percentual");
                """);

            // 3. FK Cascade — guarda com IF NOT EXISTS via pg_constraint
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_CategoriaSalarialSteps_CategoriasSalariais_CategoriaSalaria~'
                    ) THEN
                        ALTER TABLE "CategoriaSalarialSteps"
                            ADD CONSTRAINT "FK_CategoriaSalarialSteps_CategoriasSalariais_CategoriaSalaria~"
                            FOREIGN KEY ("CategoriaSalarialId")
                            REFERENCES "CategoriasSalariais" ("Id")
                            ON DELETE CASCADE;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "CategoriaSalarialSteps" CASCADE;
                ALTER TABLE "CategoriasSalariais" DROP COLUMN IF EXISTS "ValorBase";
                """);
        }
    }
}
