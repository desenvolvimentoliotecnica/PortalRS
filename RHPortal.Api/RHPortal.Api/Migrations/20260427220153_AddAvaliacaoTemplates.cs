using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAvaliacaoTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente para multi-tenant: tenants antigos podem ter recebido orphan-migration parcial
            // antes desta migration EF chegar; usar IF NOT EXISTS evita conflito de nome.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "AvaliacaoTemplates" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Codigo" character varying(64) NOT NULL,
                    "Nome" character varying(200) NOT NULL,
                    "Descricao" character varying(2000) NULL,
                    "PeriodoSugerido" character varying(50) NULL,
                    "IsSystem" boolean NOT NULL,
                    "IsActive" boolean NOT NULL,
                    "Ordem" integer NOT NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    "AtualizadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_AvaliacaoTemplates" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "AvaliacaoTemplatePerguntas" (
                    "Id" uuid NOT NULL,
                    "TemplateId" uuid NOT NULL,
                    "Texto" character varying(500) NOT NULL,
                    "Ordem" integer NOT NULL,
                    CONSTRAINT "PK_AvaliacaoTemplatePerguntas" PRIMARY KEY ("Id")
                );

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AvaliacaoTemplatePerguntas_AvaliacaoTemplates_TemplateId') THEN
                        ALTER TABLE "AvaliacaoTemplatePerguntas"
                            ADD CONSTRAINT "FK_AvaliacaoTemplatePerguntas_AvaliacaoTemplates_TemplateId"
                            FOREIGN KEY ("TemplateId") REFERENCES "AvaliacaoTemplates" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoTemplatePerguntas_TemplateId"
                    ON "AvaliacaoTemplatePerguntas" ("TemplateId");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_AvaliacaoTemplates_TenantId_Codigo"
                    ON "AvaliacaoTemplates" ("TenantId", "Codigo");

                CREATE INDEX IF NOT EXISTS "IX_AvaliacaoTemplates_TenantId_IsActive"
                    ON "AvaliacaoTemplates" ("TenantId", "IsActive");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "AvaliacaoTemplatePerguntas";
                DROP TABLE IF EXISTS "AvaliacaoTemplates";
                """);
        }
    }
}
