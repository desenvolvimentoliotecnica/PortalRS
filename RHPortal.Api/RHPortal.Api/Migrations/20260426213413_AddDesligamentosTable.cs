using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDesligamentosTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem ter a tabela já criada
            // por ApplyOrphanMigrationsAsync; usamos IF NOT EXISTS pra evitar erro.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "Desligamentos" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "IdReqRm" character varying(40) NOT NULL,
                    "ChapaRm" character varying(20) NOT NULL,
                    "FuncionarioId" uuid NULL,
                    "CodMotivoRescisao" character varying(10) NULL,
                    "MotivoRescisaoDescricao" character varying(120) NULL,
                    "CodTipoRescisao" character varying(5) NULL,
                    "TipoRescisaoDescricao" character varying(120) NULL,
                    "GerouSubstituicao" boolean NOT NULL,
                    "DataAbertura" timestamp with time zone NOT NULL,
                    "DataPrevista" timestamp with time zone NULL,
                    "DataConclusao" timestamp with time zone NULL,
                    "DataCancelamento" timestamp with time zone NULL,
                    "CodStatus" integer NOT NULL,
                    "Justificativa" text NULL,
                    "NumDiasAviso" integer NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_Desligamentos" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_Desligamentos_Funcionarios_FuncionarioId"
                        FOREIGN KEY ("FuncionarioId")
                        REFERENCES "Funcionarios" ("Id")
                        ON DELETE SET NULL
                );
                """);

            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Desligamentos_TenantId_IdReqRm"" ON ""Desligamentos"" (""TenantId"", ""IdReqRm"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Desligamentos_ChapaRm"" ON ""Desligamentos"" (""ChapaRm"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Desligamentos_CodStatus"" ON ""Desligamentos"" (""CodStatus"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Desligamentos_GerouSubstituicao"" ON ""Desligamentos"" (""GerouSubstituicao"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Desligamentos_FuncionarioId"" ON ""Desligamentos"" (""FuncionarioId"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Desligamentos");
        }
    }
}
