using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOrigemHierarquiaToVagas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem ter colunas/FKs já criadas.
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""HierarquiaId"" uuid NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""IdReqRmOrigem"" character varying(40) NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""OrigemDesligamentoId"" uuid NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""Vagas"" ADD COLUMN IF NOT EXISTS ""OrigemTipo"" smallint NOT NULL DEFAULT 0;");

            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Vagas_HierarquiaId"" ON ""Vagas"" (""HierarquiaId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Vagas_IdReqRmOrigem"" ON ""Vagas"" (""IdReqRmOrigem"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Vagas_OrigemDesligamentoId"" ON ""Vagas"" (""OrigemDesligamentoId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Vagas_OrigemTipo"" ON ""Vagas"" (""OrigemTipo"");");

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Vagas_Hierarquias_HierarquiaId') THEN
                        ALTER TABLE "Vagas"
                        ADD CONSTRAINT "FK_Vagas_Hierarquias_HierarquiaId"
                        FOREIGN KEY ("HierarquiaId") REFERENCES "Hierarquias" ("Id") ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Vagas_Desligamentos_OrigemDesligamentoId') THEN
                        ALTER TABLE "Vagas"
                        ADD CONSTRAINT "FK_Vagas_Desligamentos_OrigemDesligamentoId"
                        FOREIGN KEY ("OrigemDesligamentoId") REFERENCES "Desligamentos" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Vagas_Desligamentos_OrigemDesligamentoId", table: "Vagas");
            migrationBuilder.DropForeignKey(name: "FK_Vagas_Hierarquias_HierarquiaId", table: "Vagas");
            migrationBuilder.DropIndex(name: "IX_Vagas_HierarquiaId", table: "Vagas");
            migrationBuilder.DropIndex(name: "IX_Vagas_IdReqRmOrigem", table: "Vagas");
            migrationBuilder.DropIndex(name: "IX_Vagas_OrigemDesligamentoId", table: "Vagas");
            migrationBuilder.DropIndex(name: "IX_Vagas_OrigemTipo", table: "Vagas");
            migrationBuilder.DropColumn(name: "HierarquiaId", table: "Vagas");
            migrationBuilder.DropColumn(name: "IdReqRmOrigem", table: "Vagas");
            migrationBuilder.DropColumn(name: "OrigemDesligamentoId", table: "Vagas");
            migrationBuilder.DropColumn(name: "OrigemTipo", table: "Vagas");
        }
    }
}
