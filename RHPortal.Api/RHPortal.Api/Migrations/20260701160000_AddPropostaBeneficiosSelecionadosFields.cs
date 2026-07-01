using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260701160000_AddPropostaBeneficiosSelecionadosFields")]
public partial class AddPropostaBeneficiosSelecionadosFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "PropostasVaga" ADD COLUMN IF NOT EXISTS "IncluirBeneficiosNaProposta" boolean NOT NULL DEFAULT true;
            ALTER TABLE "PropostasVaga" ADD COLUMN IF NOT EXISTS "BeneficiosSelecionadosJson" text NULL;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "PropostasVaga" DROP COLUMN IF EXISTS "BeneficiosSelecionadosJson";
            ALTER TABLE "PropostasVaga" DROP COLUMN IF EXISTS "IncluirBeneficiosNaProposta";
            """);
    }
}
