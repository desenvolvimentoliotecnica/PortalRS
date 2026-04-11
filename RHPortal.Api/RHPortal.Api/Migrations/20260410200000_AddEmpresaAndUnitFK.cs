using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <summary>
    /// Cria a tabela <c>Empresas</c> e adiciona FK <c>EmpresaId</c> em <c>Units</c>.
    /// SQL idempotente; sem .Designer.cs — aplicado via ApplyOrphanMigrationsAsync.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260410200000_AddEmpresaAndUnitFK")]
    public partial class AddEmpresaAndUnitFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Empresas" (
                    "Id"            uuid                        NOT NULL,
                    "TenantId"      character varying(64)       NOT NULL,
                    "Code"          character varying(30)       NOT NULL,
                    "Description"   character varying(120)      NOT NULL,
                    "IsActive"      boolean                     NOT NULL DEFAULT true,
                    "CreatedAtUtc"  timestamp with time zone    NOT NULL,
                    "UpdatedAtUtc"  timestamp with time zone    NOT NULL,
                    CONSTRAINT "PK_Empresas" PRIMARY KEY ("Id")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Empresas_TenantId_Code"
                    ON "Empresas" ("TenantId", "Code");
                ALTER TABLE "Units" ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL;
                CREATE INDEX IF NOT EXISTS "IX_Units_EmpresaId"
                    ON "Units" ("EmpresaId");
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_Units_Empresas_EmpresaId'
                    ) THEN
                        ALTER TABLE "Units"
                            ADD CONSTRAINT "FK_Units_Empresas_EmpresaId"
                            FOREIGN KEY ("EmpresaId")
                            REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Units" DROP CONSTRAINT IF EXISTS "FK_Units_Empresas_EmpresaId";
                DROP INDEX IF EXISTS "IX_Units_EmpresaId";
                ALTER TABLE "Units" DROP COLUMN IF EXISTS "EmpresaId";
                DROP TABLE IF EXISTS "Empresas";
                """);
        }
    }
}
