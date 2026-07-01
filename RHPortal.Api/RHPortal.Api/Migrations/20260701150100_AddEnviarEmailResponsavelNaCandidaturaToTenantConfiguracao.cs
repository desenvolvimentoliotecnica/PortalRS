using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260701150100_AddEnviarEmailResponsavelNaCandidaturaToTenantConfiguracao")]
public partial class AddEnviarEmailResponsavelNaCandidaturaToTenantConfiguracao : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "TenantConfiguracoes"
            ADD COLUMN IF NOT EXISTS "EnviarEmailResponsavelNaCandidatura" boolean NOT NULL DEFAULT false;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "TenantConfiguracoes"
            DROP COLUMN IF EXISTS "EnviarEmailResponsavelNaCandidatura";
            """);
    }
}
