using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNivelCargoIdToFuncionarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Funcionarios"
                    ADD COLUMN IF NOT EXISTS "NivelCargoId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Funcionarios_NiveisCargo_NivelCargoId') THEN
                        ALTER TABLE "Funcionarios"
                            ADD CONSTRAINT "FK_Funcionarios_NiveisCargo_NivelCargoId"
                            FOREIGN KEY ("NivelCargoId") REFERENCES "NiveisCargo"("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_Funcionarios_NivelCargoId"
                    ON "Funcionarios" ("NivelCargoId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_Funcionarios_NivelCargoId";
                ALTER TABLE "Funcionarios" DROP CONSTRAINT IF EXISTS "FK_Funcionarios_NiveisCargo_NivelCargoId";
                ALTER TABLE "Funcionarios" DROP COLUMN IF EXISTS "NivelCargoId";
                """);
        }
    }
}
