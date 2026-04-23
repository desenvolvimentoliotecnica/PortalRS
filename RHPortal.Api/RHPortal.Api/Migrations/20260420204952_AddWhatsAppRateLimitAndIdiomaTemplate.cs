using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppRateLimitAndIdiomaTemplate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Multi-tenant: idempotente — pode rodar em bancos novos e em bancos antigos.

            // 1) Coluna Idioma em NotificacoesTemplates (varchar(10) nullable).
            migrationBuilder.Sql("""
                ALTER TABLE "NotificacoesTemplates"
                    ADD COLUMN IF NOT EXISTS "Idioma" varchar(10) NULL;
                """);

            // 2) Substituir índice único — antigo (TenantId,Etapa,Canal) → novo inclui Idioma.
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_NotificacoesTemplates_TenantId_Etapa_Canal";
                """);
            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_NotificacoesTemplates_TenantId_Etapa_Canal_Idioma"
                    ON "NotificacoesTemplates" ("TenantId", "Etapa", "Canal", "Idioma");
                """);

            // 3) Overrides de rate limit por candidato (nullable — quando null, usa default global).
            migrationBuilder.Sql("""
                ALTER TABLE "CandidatoNotificacaoPreferencias"
                    ADD COLUMN IF NOT EXISTS "WhatsAppRateLimitMaxMensagens" integer NULL;
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "CandidatoNotificacaoPreferencias"
                    ADD COLUMN IF NOT EXISTS "WhatsAppRateLimitJanelaMinutos" integer NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_NotificacoesTemplates_TenantId_Etapa_Canal_Idioma",
                table: "NotificacoesTemplates");

            migrationBuilder.DropColumn(
                name: "Idioma",
                table: "NotificacoesTemplates");

            migrationBuilder.DropColumn(
                name: "WhatsAppRateLimitJanelaMinutos",
                table: "CandidatoNotificacaoPreferencias");

            migrationBuilder.DropColumn(
                name: "WhatsAppRateLimitMaxMensagens",
                table: "CandidatoNotificacaoPreferencias");

            migrationBuilder.CreateIndex(
                name: "IX_NotificacoesTemplates_TenantId_Etapa_Canal",
                table: "NotificacoesTemplates",
                columns: new[] { "TenantId", "Etapa", "Canal" },
                unique: true);
        }
    }
}
