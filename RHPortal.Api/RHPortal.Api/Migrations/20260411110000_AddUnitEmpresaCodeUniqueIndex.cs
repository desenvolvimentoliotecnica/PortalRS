using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411110000_AddUnitEmpresaCodeUniqueIndex")]
public partial class AddUnitEmpresaCodeUniqueIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS "IX_Units_TenantId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Units_TenantId_EmpresaId_Code"
                ON "Units" ("TenantId", "EmpresaId", "Code")
                WHERE "EmpresaId" IS NOT NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS "IX_Units_TenantId_EmpresaId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Units_TenantId_Code"
                ON "Units" ("TenantId", "Code");
            """);
    }
}
