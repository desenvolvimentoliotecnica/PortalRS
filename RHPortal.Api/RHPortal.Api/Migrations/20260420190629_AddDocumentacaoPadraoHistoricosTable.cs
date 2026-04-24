using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentacaoPadraoHistoricosTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente para cenário multi-tenant: bancos de tenants antigos
            // podem já ter tido a tabela criada em releases de preview.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DocumentacaoPadraoHistoricos" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Escopo" smallint NOT NULL,
                    "NivelCargoId" uuid NULL,
                    "TipoDocumento" smallint NOT NULL,
                    "ConfiguracaoAnterior" smallint NULL,
                    "ConfiguracaoNova" smallint NULL,
                    "Acao" smallint NOT NULL,
                    "UserId" uuid NULL,
                    "UserNome" character varying(200) NULL,
                    "CriadoEmUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_DocumentacaoPadraoHistoricos" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_DocumentacaoPadraoHistoricos_NiveisCargo_NivelCargoId"
                        FOREIGN KEY ("NivelCargoId") REFERENCES "NiveisCargo" ("Id") ON DELETE SET NULL
                );
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoHistoricos_NivelCargoId"
                    ON "DocumentacaoPadraoHistoricos" ("NivelCargoId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoHistoricos_TenantId_CriadoEmUtc"
                    ON "DocumentacaoPadraoHistoricos" ("TenantId", "CriadoEmUtc");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoHistoricos_TenantId_Escopo_NivelCargoId"
                    ON "DocumentacaoPadraoHistoricos" ("TenantId", "Escopo", "NivelCargoId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocumentacaoPadraoHistoricos");
        }
    }
}
