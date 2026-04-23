using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDatasToProjetoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente para multi-tenant: bancos antigos podem já ter a coluna
            migrationBuilder.Sql("""
                ALTER TABLE "ProjetosVaga" ADD COLUMN IF NOT EXISTS "DataInicio" date NULL;
                ALTER TABLE "ProjetosVaga" ADD COLUMN IF NOT EXISTS "DataEncerramento" date NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DataEncerramento",
                table: "ProjetosVaga");

            migrationBuilder.DropColumn(
                name: "DataInicio",
                table: "ProjetosVaga");
        }
    }
}
