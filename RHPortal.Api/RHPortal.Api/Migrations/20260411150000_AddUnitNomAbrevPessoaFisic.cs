using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411150000_AddUnitNomAbrevPessoaFisic")]
public partial class AddUnitNomAbrevPessoaFisic : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "NomAbrevPessoaFisic" character varying(60) NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Units" DROP COLUMN IF EXISTS "NomAbrevPessoaFisic";
            """);
    }
}
