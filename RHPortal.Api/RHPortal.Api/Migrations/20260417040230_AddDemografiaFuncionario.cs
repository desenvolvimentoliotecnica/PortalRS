using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDemografiaFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Colunas novas em Funcionarios (idempotente para multi-tenant) ──
            migrationBuilder.Sql("""
                ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "DataAdmissao" date NULL;
                ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "DataNascimento" date NULL;
                ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "PeriodoExperienciaDias" integer NOT NULL DEFAULT 90;
                ALTER TABLE "Funcionarios" ADD COLUMN IF NOT EXISTS "Sexo" character varying(1) NULL;
                """);

            // ── Tabela DadosBancarios ──
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DadosBancarios" (
                    "Id" uuid NOT NULL,
                    "TenantId" text NOT NULL,
                    "FuncionarioId" uuid NOT NULL,
                    "Banco" character varying(200) NOT NULL,
                    "Agencia" character varying(20) NOT NULL,
                    "Conta" character varying(30) NOT NULL,
                    "TipoConta" smallint NOT NULL,
                    "Pix" character varying(150) NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_DadosBancarios" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_DadosBancarios_Funcionarios_FuncionarioId"
                        FOREIGN KEY ("FuncionarioId") REFERENCES "Funcionarios" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_DadosBancarios_FuncionarioId" ON "DadosBancarios" ("FuncionarioId");
                """);

            // ── Tabela Holerites ──
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Holerites" (
                    "Id" uuid NOT NULL,
                    "TenantId" text NOT NULL,
                    "FuncionarioId" uuid NOT NULL,
                    "MesReferencia" integer NOT NULL,
                    "AnoReferencia" integer NOT NULL,
                    "ArquivoPath" character varying(500) NOT NULL,
                    "ArquivoNome" character varying(255) NOT NULL,
                    "TamanhoBytes" bigint NOT NULL,
                    "EnviadoPorId" uuid NULL,
                    "EnviadoEmUtc" timestamp with time zone NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_Holerites" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_Holerites_Funcionarios_FuncionarioId"
                        FOREIGN KEY ("FuncionarioId") REFERENCES "Funcionarios" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_Holerites_Funcionarios_EnviadoPorId"
                        FOREIGN KEY ("EnviadoPorId") REFERENCES "Funcionarios" ("Id")
                );
                CREATE INDEX IF NOT EXISTS "IX_Holerites_FuncionarioId" ON "Holerites" ("FuncionarioId");
                CREATE INDEX IF NOT EXISTS "IX_Holerites_EnviadoPorId" ON "Holerites" ("EnviadoPorId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "DadosBancarios");
            migrationBuilder.DropTable(name: "Holerites");

            migrationBuilder.DropColumn(name: "DataAdmissao", table: "Funcionarios");
            migrationBuilder.DropColumn(name: "DataNascimento", table: "Funcionarios");
            migrationBuilder.DropColumn(name: "PeriodoExperienciaDias", table: "Funcionarios");
            migrationBuilder.DropColumn(name: "Sexo", table: "Funcionarios");
        }
    }
}
