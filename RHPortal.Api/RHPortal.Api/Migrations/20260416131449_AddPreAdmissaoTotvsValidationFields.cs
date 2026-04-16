using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPreAdmissaoTotvsValidationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "AnoChegada" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CidadeExterior" character varying(120) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodEnderecoPostalExterior" character varying(20) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DataObitoCivil" date NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Naturalizacao" character varying(60) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "OrgaoEmisPassaporte" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "PaisEmisPassaporte" character varying(10) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "PortariaNaturalizacao" character varying(60) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoCertidaoCivil" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoEstatistica" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ValidadeIdentEstrangeiro" date NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "AnoChegada",                 table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CidadeExterior",             table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "CodEnderecoPostalExterior",  table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "DataObitoCivil",             table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "Naturalizacao",              table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "OrgaoEmisPassaporte",        table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "PaisEmisPassaporte",         table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "PortariaNaturalizacao",      table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "TipoCertidaoCivil",          table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "TipoEstatistica",            table: "PreAdmissoes");
            migrationBuilder.DropColumn(name: "ValidadeIdentEstrangeiro",   table: "PreAdmissoes");
        }
    }
}
