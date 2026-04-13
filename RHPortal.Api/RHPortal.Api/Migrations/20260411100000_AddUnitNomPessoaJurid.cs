using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411100000_AddUnitNomPessoaJurid")]
public partial class AddUnitNomPessoaJurid : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "NomAbrevPessoaJurid" character varying(60) NULL;
            ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "NomPessoaJurid"      character varying(150) NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Units" DROP COLUMN IF EXISTS "NomAbrevPessoaJurid";
            ALTER TABLE "Units" DROP COLUMN IF EXISTS "NomPessoaJurid";
            """);
    }
}
