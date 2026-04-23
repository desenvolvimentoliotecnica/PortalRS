using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVagaIdAndEmIntegracaoToPreAdmissao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "VagaId" uuid NULL;
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_PreAdmissoes_Vagas_VagaId'
                          AND conrelid = '"PreAdmissoes"'::regclass
                    ) THEN
                        ALTER TABLE "PreAdmissoes"
                            ADD CONSTRAINT "FK_PreAdmissoes_Vagas_VagaId"
                            FOREIGN KEY ("VagaId") REFERENCES "Vagas"("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                CREATE INDEX IF NOT EXISTS "IX_PreAdmissoes_VagaId"
                    ON "PreAdmissoes" ("VagaId") WHERE "VagaId" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes" DROP CONSTRAINT IF EXISTS "FK_PreAdmissoes_Vagas_VagaId";
                DROP INDEX IF EXISTS "IX_PreAdmissoes_VagaId";
                ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "VagaId";
                """);
        }
    }
}
