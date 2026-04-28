using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "SurveyTemplates" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Codigo" character varying(64) NOT NULL,
                    "Nome" character varying(200) NOT NULL,
                    "Descricao" character varying(2000) NULL,
                    "TipoSurvey" character varying(64) NOT NULL,
                    "CadenciaSugerida" character varying(100) NULL,
                    "IsSystem" boolean NOT NULL,
                    "IsActive" boolean NOT NULL,
                    "Ordem" integer NOT NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    "AtualizadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_SurveyTemplates" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "SurveyTemplateQuestions" (
                    "Id" uuid NOT NULL,
                    "TemplateId" uuid NOT NULL,
                    "Texto" character varying(500) NOT NULL,
                    "Tipo" character varying(40) NOT NULL,
                    "Ordem" integer NOT NULL,
                    "OpcoesJson" text NULL,
                    CONSTRAINT "PK_SurveyTemplateQuestions" PRIMARY KEY ("Id")
                );

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SurveyTemplateQuestions_SurveyTemplates_TemplateId') THEN
                        ALTER TABLE "SurveyTemplateQuestions"
                            ADD CONSTRAINT "FK_SurveyTemplateQuestions_SurveyTemplates_TemplateId"
                            FOREIGN KEY ("TemplateId") REFERENCES "SurveyTemplates" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_SurveyTemplateQuestions_TemplateId"
                    ON "SurveyTemplateQuestions" ("TemplateId");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_SurveyTemplates_TenantId_Codigo"
                    ON "SurveyTemplates" ("TenantId", "Codigo");

                CREATE INDEX IF NOT EXISTS "IX_SurveyTemplates_TenantId_IsActive"
                    ON "SurveyTemplates" ("TenantId", "IsActive");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "SurveyTemplateQuestions";
                DROP TABLE IF EXISTS "SurveyTemplates";
                """);
        }
    }
}
