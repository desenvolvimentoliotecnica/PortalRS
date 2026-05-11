using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAnalistaRhResponsavelToSolicitacaoVaga : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga"
                ADD COLUMN IF NOT EXISTS "AnalistaRhResponsavelUserId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_AnalistaRhResponsavelUserId"
                ON "SolicitacoesVaga" ("AnalistaRhResponsavelUserId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_TenantId_AnalistaRhResponsavelUserId"
                ON "SolicitacoesVaga" ("TenantId", "AnalistaRhResponsavelUserId");
                """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_SolicitacoesVaga_Users_AnalistaRhResponsavelUserId'
                    ) THEN
                        ALTER TABLE "SolicitacoesVaga"
                        ADD CONSTRAINT "FK_SolicitacoesVaga_Users_AnalistaRhResponsavelUserId"
                        FOREIGN KEY ("AnalistaRhResponsavelUserId") REFERENCES "Users" ("Id")
                        ON DELETE SET NULL;
                    END IF;
                END
                $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga"
                DROP CONSTRAINT IF EXISTS "FK_SolicitacoesVaga_Users_AnalistaRhResponsavelUserId";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_SolicitacoesVaga_AnalistaRhResponsavelUserId";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_SolicitacoesVaga_TenantId_AnalistaRhResponsavelUserId";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "SolicitacoesVaga"
                DROP COLUMN IF EXISTS "AnalistaRhResponsavelUserId";
                """);
        }
    }
}
