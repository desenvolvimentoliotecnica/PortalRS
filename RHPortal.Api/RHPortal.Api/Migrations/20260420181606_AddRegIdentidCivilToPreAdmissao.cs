using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRegIdentidCivilToPreAdmissao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegIdentidCivilNumero" character varying(20) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegIdentidCivilUf" character varying(2) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegIdentidCivilCidade" character varying(120) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegIdentidCivilOrgEmiss" character varying(20) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegIdentidCivilDataExped" date NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "RegIdentidCivilCidade";
                ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "RegIdentidCivilDataExped";
                ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "RegIdentidCivilNumero";
                ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "RegIdentidCivilOrgEmiss";
                ALTER TABLE "PreAdmissoes" DROP COLUMN IF EXISTS "RegIdentidCivilUf";
                """);
        }
    }
}
