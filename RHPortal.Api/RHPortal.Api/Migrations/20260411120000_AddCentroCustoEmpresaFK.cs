using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411120000_AddCentroCustoEmpresaFK")]
public partial class AddCentroCustoEmpresaFK : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_CentrosCusto_EmpresaId"
                ON "CentrosCusto" ("EmpresaId");
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_CentrosCusto_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "CentrosCusto"
                        ADD CONSTRAINT "FK_CentrosCusto_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId")
                        REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            DROP INDEX IF EXISTS "IX_CentrosCusto_TenantId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CentrosCusto_TenantId_EmpresaId_Code"
                ON "CentrosCusto" ("TenantId", "EmpresaId", "Code")
                WHERE "EmpresaId" IS NOT NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS "IX_CentrosCusto_TenantId_EmpresaId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CentrosCusto_TenantId_Code"
                ON "CentrosCusto" ("TenantId", "Code");
            DROP INDEX IF EXISTS "IX_CentrosCusto_EmpresaId";
            ALTER TABLE "CentrosCusto" DROP CONSTRAINT IF EXISTS "FK_CentrosCusto_Empresas_EmpresaId";
            ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "EmpresaId";
            """);
    }
}
