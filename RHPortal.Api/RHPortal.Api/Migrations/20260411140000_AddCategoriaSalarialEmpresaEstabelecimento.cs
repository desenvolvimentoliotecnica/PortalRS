using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260411140000_AddCategoriaSalarialEmpresaEstabelecimento")]
public partial class AddCategoriaSalarialEmpresaEstabelecimento : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "CategoriasSalariais" ADD COLUMN IF NOT EXISTS "EmpresaId"         uuid NULL;
            ALTER TABLE "CategoriasSalariais" ADD COLUMN IF NOT EXISTS "EstabelecimentoId" uuid NULL;
            CREATE INDEX IF NOT EXISTS "IX_CategoriasSalariais_EmpresaId"
                ON "CategoriasSalariais" ("EmpresaId");
            CREATE INDEX IF NOT EXISTS "IX_CategoriasSalariais_EstabelecimentoId"
                ON "CategoriasSalariais" ("EstabelecimentoId");
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_CategoriasSalariais_Empresas_EmpresaId'
                ) THEN
                    ALTER TABLE "CategoriasSalariais"
                        ADD CONSTRAINT "FK_CategoriasSalariais_Empresas_EmpresaId"
                        FOREIGN KEY ("EmpresaId")
                        REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'FK_CategoriasSalariais_Units_EstabelecimentoId'
                ) THEN
                    ALTER TABLE "CategoriasSalariais"
                        ADD CONSTRAINT "FK_CategoriasSalariais_Units_EstabelecimentoId"
                        FOREIGN KEY ("EstabelecimentoId")
                        REFERENCES "Units"("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            DROP INDEX IF EXISTS "IX_CategoriasSalariais_TenantId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CategoriasSalariais_TenantId_EmpresaId_EstabelecimentoId_Code"
                ON "CategoriasSalariais" ("TenantId", "EmpresaId", "EstabelecimentoId", "Code")
                WHERE "EmpresaId" IS NOT NULL AND "EstabelecimentoId" IS NOT NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS "IX_CategoriasSalariais_TenantId_EmpresaId_EstabelecimentoId_Code";
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CategoriasSalariais_TenantId_Code"
                ON "CategoriasSalariais" ("TenantId", "Code");
            DROP INDEX IF EXISTS "IX_CategoriasSalariais_EstabelecimentoId";
            DROP INDEX IF EXISTS "IX_CategoriasSalariais_EmpresaId";
            ALTER TABLE "CategoriasSalariais" DROP CONSTRAINT IF EXISTS "FK_CategoriasSalariais_Units_EstabelecimentoId";
            ALTER TABLE "CategoriasSalariais" DROP CONSTRAINT IF EXISTS "FK_CategoriasSalariais_Empresas_EmpresaId";
            ALTER TABLE "CategoriasSalariais" DROP COLUMN IF EXISTS "EstabelecimentoId";
            ALTER TABLE "CategoriasSalariais" DROP COLUMN IF EXISTS "EmpresaId";
            """);
    }
}
