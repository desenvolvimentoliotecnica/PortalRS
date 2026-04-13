using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411130000_AddCentroCustoValidade")]
public partial class AddCentroCustoValidade : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "ValidFrom"  date NULL;
            ALTER TABLE "CentrosCusto" ADD COLUMN IF NOT EXISTS "ValidUntil" date NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "ValidFrom";
            ALTER TABLE "CentrosCusto" DROP COLUMN IF EXISTS "ValidUntil";
            """);
    }
}
