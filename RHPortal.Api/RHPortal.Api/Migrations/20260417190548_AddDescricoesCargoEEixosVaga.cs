using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDescricoesCargoEEixosVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente — compatível com bancos de tenants em diferentes estados.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DescricoesCargo" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Code" character varying(30) NOT NULL,
                    "Title" character varying(200) NOT NULL,
                    "Summary" character varying(2000) NULL,
                    "Responsibilities" text NULL,
                    "Requirements" text NULL,
                    "NiceToHave" text NULL,
                    "Benefits" text NULL,
                    "IsTemplate" boolean NOT NULL,
                    "NivelCargoId" uuid NULL,
                    "IsActive" boolean NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_DescricoesCargo" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_DescricoesCargo_TenantId_Code"
                    ON "DescricoesCargo" ("TenantId", "Code");
                CREATE INDEX IF NOT EXISTS "IX_DescricoesCargo_NivelCargoId"
                    ON "DescricoesCargo" ("NivelCargoId");
                CREATE INDEX IF NOT EXISTS "IX_DescricoesCargo_IsActive"
                    ON "DescricoesCargo" ("IsActive");

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_DescricoesCargo_NiveisCargo_NivelCargoId'
                    ) THEN
                        ALTER TABLE "DescricoesCargo"
                            ADD CONSTRAINT "FK_DescricoesCargo_NiveisCargo_NivelCargoId"
                            FOREIGN KEY ("NivelCargoId")
                            REFERENCES "NiveisCargo" ("Id")
                            ON DELETE SET NULL;
                    END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS "EixosVaga" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Code" character varying(30) NOT NULL,
                    "Name" character varying(120) NOT NULL,
                    "Description" character varying(400) NULL,
                    "SlaDiasMetaFechamento" integer NULL,
                    "IsActive" boolean NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_EixosVaga" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_EixosVaga_TenantId_Code"
                    ON "EixosVaga" ("TenantId", "Code");
                CREATE INDEX IF NOT EXISTS "IX_EixosVaga_IsActive"
                    ON "EixosVaga" ("IsActive");

                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "EixoVagaId" uuid NULL;

                CREATE INDEX IF NOT EXISTS "IX_Vagas_EixoVagaId"
                    ON "Vagas" ("EixoVagaId");

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_Vagas_EixosVaga_EixoVagaId'
                    ) THEN
                        ALTER TABLE "Vagas"
                            ADD CONSTRAINT "FK_Vagas_EixosVaga_EixoVagaId"
                            FOREIGN KEY ("EixoVagaId")
                            REFERENCES "EixosVaga" ("Id")
                            ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_EixosVaga_EixoVagaId";
                DROP INDEX IF EXISTS "IX_Vagas_EixoVagaId";
                ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "EixoVagaId";
                DROP TABLE IF EXISTS "EixosVaga";
                DROP TABLE IF EXISTS "DescricoesCargo";
                """);
        }
    }
}
