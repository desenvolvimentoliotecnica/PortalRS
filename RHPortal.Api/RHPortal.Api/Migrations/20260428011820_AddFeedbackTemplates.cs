using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "FeedbackTemplates" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Codigo" character varying(64) NOT NULL,
                    "Nome" character varying(200) NOT NULL,
                    "Descricao" character varying(2000) NULL,
                    "Categoria" character varying(64) NULL,
                    "Conteudo" character varying(4000) NOT NULL,
                    "TipoSugerido" character varying(40) NULL,
                    "IsSystem" boolean NOT NULL,
                    "IsActive" boolean NOT NULL,
                    "Ordem" integer NOT NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    "AtualizadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_FeedbackTemplates" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_FeedbackTemplates_TenantId_Codigo"
                    ON "FeedbackTemplates" ("TenantId", "Codigo");

                CREATE INDEX IF NOT EXISTS "IX_FeedbackTemplates_TenantId_IsActive"
                    ON "FeedbackTemplates" ("TenantId", "IsActive");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP TABLE IF EXISTS "FeedbackTemplates";""");
        }
    }
}
