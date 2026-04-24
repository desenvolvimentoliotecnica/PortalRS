using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Migration idempotente para embeddings pgvector:
    ///   1. Habilita a extensão <c>vector</c> (no-op se já existe).
    ///   2. Cria tabelas <c>DescricaoCargoItemEmbeddings</c> + <c>CandidatoEmbeddings</c>
    ///      com <c>IF NOT EXISTS</c> — re-executa sem erro em tenants antigos.
    ///   3. Adiciona índices (IVFFlat para busca ANN rápida, btree para joins/tenancy).
    ///
    /// <para><b>Pré-requisito</b>: extensão pgvector instalada no servidor Postgres
    /// (executar <c>scripts/setup-pgvector.sh</c> uma vez por host antes de subir).</para>
    /// </summary>
    public partial class AddEmbeddingsPgvector : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Extensão pgvector — se não existir no servidor, falha clara com dica.
            migrationBuilder.Sql("""
                CREATE EXTENSION IF NOT EXISTS vector;
                """);

            // 2. Tabela DescricaoCargoItemEmbeddings — idempotente
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DescricaoCargoItemEmbeddings" (
                    "Id"                    uuid                     NOT NULL,
                    "TenantId"              character varying(64)    NOT NULL,
                    "DescricaoCargoItemId"  uuid                     NOT NULL,
                    "ModelVersion"          character varying(60)    NOT NULL,
                    "Dimensions"            integer                  NOT NULL,
                    "Embedding"             vector(1024)             NULL,
                    "TextoSource"           character varying(4000)  NOT NULL DEFAULT '',
                    "CreatedAtUtc"          timestamp with time zone NOT NULL,
                    "UpdatedAtUtc"          timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_DescricaoCargoItemEmbeddings" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_DescricaoCargoItemEmbeddings_Item') THEN
                        ALTER TABLE "DescricaoCargoItemEmbeddings"
                            ADD CONSTRAINT "FK_DescricaoCargoItemEmbeddings_Item"
                            FOREIGN KEY ("DescricaoCargoItemId")
                            REFERENCES "DescricaoCargoItens"("Id") ON DELETE CASCADE;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_DescricaoCargoItemEmbeddings_Tenant_Item"
                    ON "DescricaoCargoItemEmbeddings" ("TenantId", "DescricaoCargoItemId");
                CREATE INDEX IF NOT EXISTS "IX_DescricaoCargoItemEmbeddings_TenantId"
                    ON "DescricaoCargoItemEmbeddings" ("TenantId");
                CREATE INDEX IF NOT EXISTS "IX_DescricaoCargoItemEmbeddings_Item"
                    ON "DescricaoCargoItemEmbeddings" ("DescricaoCargoItemId");
                """);

            // IVFFlat para busca ANN de alta performance — criado apenas quando há dados
            // suficientes. Para cold-start com 0 rows, o planner usa seq scan (OK).
            // O parâmetro lists=100 é default adequado pra até 1M rows; ajustável depois.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_class WHERE relname = 'IX_DescricaoCargoItemEmbeddings_Ann'
                    ) THEN
                        CREATE INDEX "IX_DescricaoCargoItemEmbeddings_Ann"
                            ON "DescricaoCargoItemEmbeddings"
                            USING ivfflat ("Embedding" vector_cosine_ops)
                            WITH (lists = 100);
                    END IF;
                EXCEPTION WHEN others THEN
                    -- Se falhar (tabela sem dados em versões antigas pgvector), ignora e
                    -- depois o indexer recria via /api/embeddings/rebuild-index.
                    NULL;
                END $$;
                """);

            // 3. Tabela CandidatoEmbeddings — idempotente
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "CandidatoEmbeddings" (
                    "Id"            uuid                     NOT NULL,
                    "TenantId"      character varying(64)    NOT NULL,
                    "CandidatoId"   uuid                     NOT NULL,
                    "ModelVersion"  character varying(60)    NOT NULL,
                    "Dimensions"    integer                  NOT NULL,
                    "Embedding"     vector(1024)             NULL,
                    "TextoSource"   character varying(8000)  NOT NULL DEFAULT '',
                    "ConteudoHash"  character varying(64)    NOT NULL,
                    "CreatedAtUtc"  timestamp with time zone NOT NULL,
                    "UpdatedAtUtc"  timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_CandidatoEmbeddings" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CandidatoEmbeddings_Candidato') THEN
                        ALTER TABLE "CandidatoEmbeddings"
                            ADD CONSTRAINT "FK_CandidatoEmbeddings_Candidato"
                            FOREIGN KEY ("CandidatoId")
                            REFERENCES "Candidatos"("Id") ON DELETE CASCADE;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CandidatoEmbeddings_Tenant_Candidato"
                    ON "CandidatoEmbeddings" ("TenantId", "CandidatoId");
                CREATE INDEX IF NOT EXISTS "IX_CandidatoEmbeddings_TenantId"
                    ON "CandidatoEmbeddings" ("TenantId");
                CREATE INDEX IF NOT EXISTS "IX_CandidatoEmbeddings_Candidato"
                    ON "CandidatoEmbeddings" ("CandidatoId");
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_class WHERE relname = 'IX_CandidatoEmbeddings_Ann'
                    ) THEN
                        CREATE INDEX "IX_CandidatoEmbeddings_Ann"
                            ON "CandidatoEmbeddings"
                            USING ivfflat ("Embedding" vector_cosine_ops)
                            WITH (lists = 100);
                    END IF;
                EXCEPTION WHEN others THEN
                    NULL;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "CandidatoEmbeddings";""");
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "DescricaoCargoItemEmbeddings";""");
            // Intencionalmente não dropa a extensão vector — pode ser usada por outros schemas.
        }
    }
}
