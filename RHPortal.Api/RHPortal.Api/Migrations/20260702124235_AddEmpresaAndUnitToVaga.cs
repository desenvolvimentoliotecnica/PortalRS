using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations;

/// <inheritdoc />
public partial class AddEmpresaAndUnitToVaga : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL;
            ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "UnitId" uuid NULL;
            """);

        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_Vagas_EmpresaId" ON "Vagas" ("EmpresaId");
            CREATE INDEX IF NOT EXISTS "IX_Vagas_UnitId" ON "Vagas" ("UnitId");
            CREATE INDEX IF NOT EXISTS "IX_Vagas_TenantId_UnitId" ON "Vagas" ("TenantId", "UnitId");
            """);

        migrationBuilder.Sql("""
            DO $EF$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_Vagas_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "Vagas"
                        ADD CONSTRAINT "FK_Vagas_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId") REFERENCES "Empresas" ("Id") ON DELETE SET NULL;
                END IF;
            END $EF$;
            """);

        migrationBuilder.Sql("""
            DO $EF$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_Vagas_Units_UnitId'
                ) THEN
                    ALTER TABLE "Vagas"
                        ADD CONSTRAINT "FK_Vagas_Units_UnitId"
                        FOREIGN KEY ("UnitId") REFERENCES "Units" ("Id") ON DELETE SET NULL;
                END IF;
            END $EF$;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_Units_UnitId";
            ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_Empresas_EmpresaId";
            DROP INDEX IF EXISTS "IX_Vagas_TenantId_UnitId";
            DROP INDEX IF EXISTS "IX_Vagas_UnitId";
            DROP INDEX IF EXISTS "IX_Vagas_EmpresaId";
            ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "UnitId";
            ALTER TABLE "Vagas" DROP COLUMN IF EXISTS "EmpresaId";
            """);
    }
}
