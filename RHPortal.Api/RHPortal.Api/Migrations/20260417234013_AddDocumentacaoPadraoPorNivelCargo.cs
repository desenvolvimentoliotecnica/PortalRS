using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentacaoPadraoPorNivelCargo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DocumentacaoPadraoPorNivelCargoConfigs" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "NivelCargoId" uuid NOT NULL,
                    "TipoDocumento" smallint NOT NULL,
                    "Configuracao" smallint NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_DocumentacaoPadraoPorNivelCargoConfigs" PRIMARY KEY ("Id")
                );

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_DocumentacaoPadraoPorNivelCargoConfigs_NiveisCargo_NivelCar~'
                    ) THEN
                        ALTER TABLE "DocumentacaoPadraoPorNivelCargoConfigs"
                        ADD CONSTRAINT "FK_DocumentacaoPadraoPorNivelCargoConfigs_NiveisCargo_NivelCar~"
                        FOREIGN KEY ("NivelCargoId") REFERENCES "NiveisCargo" ("Id") ON DELETE CASCADE;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoPorNivelCargoConfigs_NivelCargoId"
                    ON "DocumentacaoPadraoPorNivelCargoConfigs" ("NivelCargoId");

                CREATE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoPorNivelCargoConfigs_TenantId_NivelCargoId"
                    ON "DocumentacaoPadraoPorNivelCargoConfigs" ("TenantId", "NivelCargoId");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_DocumentacaoPadraoPorNivelCargoConfigs_TenantId_NivelCargoI~"
                    ON "DocumentacaoPadraoPorNivelCargoConfigs" ("TenantId", "NivelCargoId", "TipoDocumento");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "DocumentacaoPadraoPorNivelCargoConfigs";
                """);
        }
    }
}
