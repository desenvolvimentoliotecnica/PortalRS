using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHierarquiaIdToFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem ter coluna/FK já criada.
            migrationBuilder.Sql(@"ALTER TABLE ""Funcionarios"" ADD COLUMN IF NOT EXISTS ""HierarquiaId"" uuid NULL;");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Funcionarios_HierarquiaId"" ON ""Funcionarios"" (""HierarquiaId"");");
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'FK_Funcionarios_Hierarquias_HierarquiaId'
                    ) THEN
                        ALTER TABLE "Funcionarios"
                        ADD CONSTRAINT "FK_Funcionarios_Hierarquias_HierarquiaId"
                        FOREIGN KEY ("HierarquiaId") REFERENCES "Hierarquias" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Funcionarios_Hierarquias_HierarquiaId",
                table: "Funcionarios");
            migrationBuilder.DropIndex(
                name: "IX_Funcionarios_HierarquiaId",
                table: "Funcionarios");
            migrationBuilder.DropColumn(
                name: "HierarquiaId",
                table: "Funcionarios");
        }
    }
}
