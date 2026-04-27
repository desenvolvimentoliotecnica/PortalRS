using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFuncionarioMovimentacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotente (CLAUDE.md): tenants antigos podem ter a tabela já criada.
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "FuncionarioMovimentacoes" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "FuncionarioId" uuid NULL,
                    "ChapaRm" character varying(20) NOT NULL,
                    "IdReqRm" character varying(40) NOT NULL,
                    "TipoMovimentacao" smallint NOT NULL,
                    "TipoDescricao" character varying(60) NULL,
                    "DataAbertura" timestamp with time zone NOT NULL,
                    "DataConclusao" timestamp with time zone NULL,
                    "DataCancelamento" timestamp with time zone NULL,
                    "CodStatus" integer NOT NULL,
                    "StatusDescricao" character varying(60) NULL,
                    "CodFuncaoOrigem" character varying(20) NULL,
                    "FuncaoOrigemNome" character varying(160) NULL,
                    "CodSecaoOrigem" character varying(60) NULL,
                    "CodSecaoDestino" character varying(60) NULL,
                    "CodFuncaoDestino" character varying(20) NULL,
                    "FuncaoDestinoNome" character varying(160) NULL,
                    "HierarquiaOrigemId" uuid NULL,
                    "HierarquiaDestinoId" uuid NULL,
                    "IdHierarquiaOrigemRm" integer NULL,
                    "IdHierarquiaDestinoRm" integer NULL,
                    "SalarioOrigem" numeric(18,2) NULL,
                    "SalarioDestino" numeric(18,2) NULL,
                    "Justificativa" text NULL,
                    "GerouSubstituicao" boolean NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_FuncionarioMovimentacoes" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_FuncionarioMovimentacoes_Funcionarios_FuncionarioId"
                        FOREIGN KEY ("FuncionarioId") REFERENCES "Funcionarios" ("Id") ON DELETE SET NULL
                );
                """);
            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_FuncionarioMovimentacoes_TenantId_IdReqRm"" ON ""FuncionarioMovimentacoes"" (""TenantId"", ""IdReqRm"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_FuncionarioMovimentacoes_ChapaRm"" ON ""FuncionarioMovimentacoes"" (""ChapaRm"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_FuncionarioMovimentacoes_TipoMovimentacao"" ON ""FuncionarioMovimentacoes"" (""TipoMovimentacao"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_FuncionarioMovimentacoes_FuncionarioId"" ON ""FuncionarioMovimentacoes"" (""FuncionarioId"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "FuncionarioMovimentacoes");
        }
    }
}
