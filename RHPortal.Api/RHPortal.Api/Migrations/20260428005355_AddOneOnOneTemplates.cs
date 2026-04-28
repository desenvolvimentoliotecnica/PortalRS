using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOneOnOneTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente para multi-tenant: tenants antigos podem ter recebido orphan-migration
            // antes desta chegar; IF NOT EXISTS evita conflito.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "OneOnOneTemplates" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Codigo" character varying(64) NOT NULL,
                    "Nome" character varying(200) NOT NULL,
                    "Descricao" character varying(2000) NULL,
                    "Categoria" character varying(64) NULL,
                    "IsSystem" boolean NOT NULL,
                    "IsActive" boolean NOT NULL,
                    "Ordem" integer NOT NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    "AtualizadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_OneOnOneTemplates" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "OneOnOneTemplateItens" (
                    "Id" uuid NOT NULL,
                    "TemplateId" uuid NOT NULL,
                    "Texto" character varying(500) NOT NULL,
                    "Ordem" integer NOT NULL,
                    CONSTRAINT "PK_OneOnOneTemplateItens" PRIMARY KEY ("Id")
                );

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_OneOnOneTemplateItens_OneOnOneTemplates_TemplateId') THEN
                        ALTER TABLE "OneOnOneTemplateItens"
                            ADD CONSTRAINT "FK_OneOnOneTemplateItens_OneOnOneTemplates_TemplateId"
                            FOREIGN KEY ("TemplateId") REFERENCES "OneOnOneTemplates" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_OneOnOneTemplateItens_TemplateId"
                    ON "OneOnOneTemplateItens" ("TemplateId");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_OneOnOneTemplates_TenantId_Codigo"
                    ON "OneOnOneTemplates" ("TenantId", "Codigo");

                CREATE INDEX IF NOT EXISTS "IX_OneOnOneTemplates_TenantId_IsActive"
                    ON "OneOnOneTemplates" ("TenantId", "IsActive");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "OneOnOneTemplateItens";
                DROP TABLE IF EXISTS "OneOnOneTemplates";
                """);
        }
    }
}
