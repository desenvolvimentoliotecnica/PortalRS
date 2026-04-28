using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHierarquiasTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem ter a tabela já criada
            // por ApplyOrphanMigrationsAsync; usamos IF NOT EXISTS pra evitar erro.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Hierarquias" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "IdHierarquiaRm" integer NOT NULL,
                    "Descricao" character varying(200) NOT NULL,
                    "IdHierarquiaSuperiorRm" integer NULL,
                    "HierarquiaSuperiorId" uuid NULL,
                    "Estrutura" character varying(200) NULL,
                    "IdNivelHierarquiaRm" integer NULL,
                    "IsActive" boolean NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_Hierarquias" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_Hierarquias_Hierarquias_HierarquiaSuperiorId"
                        FOREIGN KEY ("HierarquiaSuperiorId")
                        REFERENCES "Hierarquias" ("Id")
                        ON DELETE RESTRICT
                );
                """);

            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Hierarquias_Estrutura"" ON ""Hierarquias"" (""Estrutura"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Hierarquias_HierarquiaSuperiorId"" ON ""Hierarquias"" (""HierarquiaSuperiorId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Hierarquias_IdHierarquiaSuperiorRm"" ON ""Hierarquias"" (""IdHierarquiaSuperiorRm"");");
            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Hierarquias_TenantId_IdHierarquiaRm"" ON ""Hierarquias"" (""TenantId"", ""IdHierarquiaRm"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Hierarquias");
        }
    }
}
