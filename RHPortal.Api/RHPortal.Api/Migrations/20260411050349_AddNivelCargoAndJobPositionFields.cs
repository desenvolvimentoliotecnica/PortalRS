using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNivelCargoAndJobPositionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_Units_TenantId_Code"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_CentrosCusto_TenantId_Code"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_CategoriasSalariais_TenantId_Code"";");

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Empresas" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "Code" character varying(30) NOT NULL,
                    "Description" character varying(120) NOT NULL,
                    "IsActive" boolean NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_Empresas" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "NiveisCargo" (
                    "Id" uuid NOT NULL,
                    "TenantId" text NOT NULL,
                    "CdnNivCargo" integer NOT NULL,
                    "NomReduz" character varying(6) NOT NULL,
                    "NomComplet" character varying(40) NOT NULL,
                    "IsActive" boolean NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_NiveisCargo" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "Units"
                    ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL,
                    ADD COLUMN IF NOT EXISTS "NomAbrevPessoaFisic" text NULL,
                    ADD COLUMN IF NOT EXISTS "NomAbrevPessoaJurid" text NULL,
                    ADD COLUMN IF NOT EXISTS "NomPessoaJurid" text NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "JobPositions"
                    ADD COLUMN IF NOT EXISTS "DesEnvelPagto" character varying(40) NULL,
                    ADD COLUMN IF NOT EXISTS "NivelCargoId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "CentrosCusto"
                    ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL,
                    ADD COLUMN IF NOT EXISTS "ValidFrom" date NULL,
                    ADD COLUMN IF NOT EXISTS "ValidUntil" date NULL;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "CategoriasSalariais"
                    ADD COLUMN IF NOT EXISTS "EmpresaId" uuid NULL,
                    ADD COLUMN IF NOT EXISTS "EstabelecimentoId" uuid NULL;
                """);

            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Units_Empresas_EmpresaId') THEN
                        ALTER TABLE "Units" ADD CONSTRAINT "FK_Units_Empresas_EmpresaId"
                            FOREIGN KEY ("EmpresaId") REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CentrosCusto_Empresas_EmpresaId') THEN
                        ALTER TABLE "CentrosCusto" ADD CONSTRAINT "FK_CentrosCusto_Empresas_EmpresaId"
                            FOREIGN KEY ("EmpresaId") REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CategoriasSalariais_Empresas_EmpresaId') THEN
                        ALTER TABLE "CategoriasSalariais" ADD CONSTRAINT "FK_CategoriasSalariais_Empresas_EmpresaId"
                            FOREIGN KEY ("EmpresaId") REFERENCES "Empresas"("Id") ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CategoriasSalariais_Units_EstabelecimentoId') THEN
                        ALTER TABLE "CategoriasSalariais" ADD CONSTRAINT "FK_CategoriasSalariais_Units_EstabelecimentoId"
                            FOREIGN KEY ("EstabelecimentoId") REFERENCES "Units"("Id") ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_JobPositions_NiveisCargo_NivelCargoId') THEN
                        ALTER TABLE "JobPositions" ADD CONSTRAINT "FK_JobPositions_NiveisCargo_NivelCargoId"
                            FOREIGN KEY ("NivelCargoId") REFERENCES "NiveisCargo"("Id");
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_Units_EmpresaId" ON "Units" ("EmpresaId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Units_TenantId_EmpresaId_Code" ON "Units" ("TenantId", "EmpresaId", "Code") WHERE "EmpresaId" IS NOT NULL;
                CREATE INDEX IF NOT EXISTS "IX_JobPositions_NivelCargoId" ON "JobPositions" ("NivelCargoId");
                CREATE INDEX IF NOT EXISTS "IX_CentrosCusto_EmpresaId" ON "CentrosCusto" ("EmpresaId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CentrosCusto_TenantId_EmpresaId_Code" ON "CentrosCusto" ("TenantId", "EmpresaId", "Code") WHERE "EmpresaId" IS NOT NULL;
                CREATE INDEX IF NOT EXISTS "IX_CategoriasSalariais_EmpresaId" ON "CategoriasSalariais" ("EmpresaId");
                CREATE INDEX IF NOT EXISTS "IX_CategoriasSalariais_EstabelecimentoId" ON "CategoriasSalariais" ("EstabelecimentoId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_CategoriasSalariais_TenantId_EmpresaId_EstabelecimentoId_Co~" ON "CategoriasSalariais" ("TenantId", "EmpresaId", "EstabelecimentoId", "Code") WHERE "EmpresaId" IS NOT NULL AND "EstabelecimentoId" IS NOT NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Empresas_TenantId_Code" ON "Empresas" ("TenantId", "Code");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CategoriasSalariais_Empresas_EmpresaId",
                table: "CategoriasSalariais");

            migrationBuilder.DropForeignKey(
                name: "FK_CategoriasSalariais_Units_EstabelecimentoId",
                table: "CategoriasSalariais");

            migrationBuilder.DropForeignKey(
                name: "FK_CentrosCusto_Empresas_EmpresaId",
                table: "CentrosCusto");

            migrationBuilder.DropForeignKey(
                name: "FK_JobPositions_NiveisCargo_NivelCargoId",
                table: "JobPositions");

            migrationBuilder.DropForeignKey(
                name: "FK_Units_Empresas_EmpresaId",
                table: "Units");

            migrationBuilder.DropTable(
                name: "Empresas");

            migrationBuilder.DropTable(
                name: "NiveisCargo");

            migrationBuilder.DropIndex(
                name: "IX_Units_EmpresaId",
                table: "Units");

            migrationBuilder.DropIndex(
                name: "IX_Units_TenantId_EmpresaId_Code",
                table: "Units");

            migrationBuilder.DropIndex(
                name: "IX_JobPositions_NivelCargoId",
                table: "JobPositions");

            migrationBuilder.DropIndex(
                name: "IX_CentrosCusto_EmpresaId",
                table: "CentrosCusto");

            migrationBuilder.DropIndex(
                name: "IX_CentrosCusto_TenantId_EmpresaId_Code",
                table: "CentrosCusto");

            migrationBuilder.DropIndex(
                name: "IX_CategoriasSalariais_EmpresaId",
                table: "CategoriasSalariais");

            migrationBuilder.DropIndex(
                name: "IX_CategoriasSalariais_EstabelecimentoId",
                table: "CategoriasSalariais");

            migrationBuilder.DropIndex(
                name: "IX_CategoriasSalariais_TenantId_EmpresaId_EstabelecimentoId_Co~",
                table: "CategoriasSalariais");

            migrationBuilder.DropColumn(
                name: "EmpresaId",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "NomAbrevPessoaFisic",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "NomAbrevPessoaJurid",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "NomPessoaJurid",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "DesEnvelPagto",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "NivelCargoId",
                table: "JobPositions");

            migrationBuilder.DropColumn(
                name: "EmpresaId",
                table: "CentrosCusto");

            migrationBuilder.DropColumn(
                name: "ValidFrom",
                table: "CentrosCusto");

            migrationBuilder.DropColumn(
                name: "ValidUntil",
                table: "CentrosCusto");

            migrationBuilder.DropColumn(
                name: "EmpresaId",
                table: "CategoriasSalariais");

            migrationBuilder.DropColumn(
                name: "EstabelecimentoId",
                table: "CategoriasSalariais");

            migrationBuilder.CreateIndex(
                name: "IX_Units_TenantId_Code",
                table: "Units",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CentrosCusto_TenantId_Code",
                table: "CentrosCusto",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CategoriasSalariais_TenantId_Code",
                table: "CategoriasSalariais",
                columns: new[] { "TenantId", "Code" },
                unique: true);
        }
    }
}
