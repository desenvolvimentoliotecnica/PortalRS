using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMetaCheckinAndParentMetaId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                -- Coluna ParentMetaId em Metas (idempotente)
                ALTER TABLE "Metas" ADD COLUMN IF NOT EXISTS "ParentMetaId" uuid NULL;

                -- Self-FK
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Metas_Metas_ParentMetaId') THEN
                        ALTER TABLE "Metas"
                            ADD CONSTRAINT "FK_Metas_Metas_ParentMetaId"
                            FOREIGN KEY ("ParentMetaId") REFERENCES "Metas" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_Metas_TenantId_ParentMetaId"
                    ON "Metas" ("TenantId", "ParentMetaId");

                -- Tabela MetaCheckins
                CREATE TABLE IF NOT EXISTS "MetaCheckins" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "MetaId" uuid NOT NULL,
                    "Status" integer NOT NULL,
                    "ValorAtual" numeric(18,4) NULL,
                    "Comentario" character varying(2000) NULL,
                    "CriadoPorId" uuid NOT NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_MetaCheckins" PRIMARY KEY ("Id")
                );

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_MetaCheckins_Metas_MetaId') THEN
                        ALTER TABLE "MetaCheckins"
                            ADD CONSTRAINT "FK_MetaCheckins_Metas_MetaId"
                            FOREIGN KEY ("MetaId") REFERENCES "Metas" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_MetaCheckins_Funcionarios_CriadoPorId') THEN
                        ALTER TABLE "MetaCheckins"
                            ADD CONSTRAINT "FK_MetaCheckins_Funcionarios_CriadoPorId"
                            FOREIGN KEY ("CriadoPorId") REFERENCES "Funcionarios" ("Id") ON DELETE RESTRICT;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_MetaCheckins_MetaId"
                    ON "MetaCheckins" ("MetaId");
                CREATE INDEX IF NOT EXISTS "IX_MetaCheckins_CriadoPorId"
                    ON "MetaCheckins" ("CriadoPorId");
                CREATE INDEX IF NOT EXISTS "IX_MetaCheckins_TenantId_MetaId_CriadoEmUtc"
                    ON "MetaCheckins" ("TenantId", "MetaId", "CriadoEmUtc");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "MetaCheckins";
                ALTER TABLE "Metas" DROP CONSTRAINT IF EXISTS "FK_Metas_Metas_ParentMetaId";
                DROP INDEX IF EXISTS "IX_Metas_TenantId_ParentMetaId";
                ALTER TABLE "Metas" DROP COLUMN IF EXISTS "ParentMetaId";
                """);
        }
    }
}
