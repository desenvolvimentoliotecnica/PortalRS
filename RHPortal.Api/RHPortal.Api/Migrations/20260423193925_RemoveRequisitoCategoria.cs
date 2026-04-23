using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Remove a entidade <c>RequisitoCategoria</c> ("Função" na UI) — conceito
    /// redundante com <c>JobPosition</c> (Cargo). A tela <c>/categorias</c> no Next
    /// foi removida, o item <c>nav-categorias</c> sumiu do <c>NavegacaoManifest</c> e
    /// as FKs <c>Funcionarios.RequisitoCategoriaId</c> + <c>PreAdmissoes.RequisitoCategoriaId</c>
    /// foram dropadas.
    ///
    /// Migration idempotente: usa <c>DROP ... IF EXISTS</c> em vez dos helpers do EF
    /// porque tenants em produção podem estar em estágios diferentes — alguns já
    /// com o FK dropado manualmente, outros com a tabela intacta. <c>ApplyOrphan
    /// MigrationsAsync</c> também pode rodar essa migration fora do fluxo normal
    /// (DB novo que nunca teve a tabela), então precisa ser re-executável sem crash.
    /// </summary>
    public partial class RemoveRequisitoCategoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Dropa FKs (IF EXISTS) antes de dropar colunas/tabela — ordem importa
            //    porque PG não deixa dropar tabela pai enquanto houver FK apontando pra ela.
            migrationBuilder.Sql("""
                ALTER TABLE IF EXISTS "Funcionarios"
                    DROP CONSTRAINT IF EXISTS "FK_Funcionarios_RequisitoCategorias_RequisitoCategoriaId";
                ALTER TABLE IF EXISTS "PreAdmissoes"
                    DROP CONSTRAINT IF EXISTS "FK_PreAdmissoes_RequisitoCategorias_RequisitoCategoriaId";
                """);

            // 2. Dropa índices (IF EXISTS)
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_Funcionarios_RequisitoCategoriaId";
                DROP INDEX IF EXISTS "IX_PreAdmissoes_RequisitoCategoriaId";
                """);

            // 3. Dropa colunas (IF EXISTS) nas tabelas filhas
            migrationBuilder.Sql("""
                ALTER TABLE IF EXISTS "Funcionarios" DROP COLUMN IF EXISTS "RequisitoCategoriaId";
                ALTER TABLE IF EXISTS "PreAdmissoes" DROP COLUMN IF EXISTS "RequisitoCategoriaId";
                """);

            // 4. Dropa a tabela RequisitoCategorias (IF EXISTS, CASCADE caso sobre algum vínculo órfão)
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "RequisitoCategorias" CASCADE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert: recria tabela + colunas. Sem backfill de dados — quem reverter
            // terá as colunas vazias (null) e a tabela também vazia.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RequisitoCategorias" (
                    "Id"       uuid                     NOT NULL,
                    "TenantId" character varying(64)    NOT NULL,
                    "Code"     character varying(40)    NOT NULL,
                    "Name"     character varying(120)   NOT NULL,
                    "Description" character varying(1000),
                    "IsActive" boolean                  NOT NULL DEFAULT true,
                    CONSTRAINT "PK_RequisitoCategorias" PRIMARY KEY ("Id")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_RequisitoCategorias_TenantId_Code"
                    ON "RequisitoCategorias" ("TenantId", "Code");
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "RequisitoCategoriaId" uuid NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RequisitoCategoriaId" uuid NULL;
                CREATE INDEX IF NOT EXISTS "IX_Funcionarios_RequisitoCategoriaId" ON "Funcionarios" ("RequisitoCategoriaId");
                CREATE INDEX IF NOT EXISTS "IX_PreAdmissoes_RequisitoCategoriaId" ON "PreAdmissoes" ("RequisitoCategoriaId");
                """);

            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                                   WHERE constraint_name = 'FK_Funcionarios_RequisitoCategorias_RequisitoCategoriaId') THEN
                        ALTER TABLE "Funcionarios"
                            ADD CONSTRAINT "FK_Funcionarios_RequisitoCategorias_RequisitoCategoriaId"
                            FOREIGN KEY ("RequisitoCategoriaId") REFERENCES "RequisitoCategorias" ("Id") ON DELETE RESTRICT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                                   WHERE constraint_name = 'FK_PreAdmissoes_RequisitoCategorias_RequisitoCategoriaId') THEN
                        ALTER TABLE "PreAdmissoes"
                            ADD CONSTRAINT "FK_PreAdmissoes_RequisitoCategorias_RequisitoCategoriaId"
                            FOREIGN KEY ("RequisitoCategoriaId") REFERENCES "RequisitoCategorias" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }
    }
}
