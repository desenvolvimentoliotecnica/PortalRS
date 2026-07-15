using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260715135100_AddPreAdmissaoDpPacoteFields")]
public partial class AddPreAdmissaoDpPacoteFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DpAccessToken" character varying(64) NULL;
            ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DpTokenExpiraEmUtc" timestamp with time zone NULL;
            ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DpEnviadoEmUtc" timestamp with time zone NULL;
            ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DpEnviadoParaEmail" character varying(180) NULL;
            ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DpEnviadoPorUserId" uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_PreAdmissoes_DpAccessToken" ON "PreAdmissoes" ("DpAccessToken") WHERE "DpAccessToken" IS NOT NULL;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS "IX_PreAdmissoes_DpAccessToken";
            ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "DpEnviadoPorUserId";
            ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "DpEnviadoParaEmail";
            ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "DpEnviadoEmUtc";
            ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "DpTokenExpiraEmUtc";
            ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "DpAccessToken";
            """);
    }
}
