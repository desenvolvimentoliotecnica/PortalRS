using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RhPortal.Api.Infrastructure.Data;

#nullable disable

namespace RhPortal.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260411200000_AddEtapasConfigAprovacao")]
    public partial class AddEtapasConfigAprovacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN

-- EtapasConfigAprovacao
CREATE TABLE IF NOT EXISTS ""EtapasConfigAprovacao"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" text NOT NULL,
    ""TipoFluxo"" smallint NOT NULL,
    ""Ordem"" integer NOT NULL,
    ""Label"" character varying(120) NOT NULL DEFAULT '',
    ""TipoAprovador"" smallint NOT NULL DEFAULT 0,
    ""FuncionarioFixoId"" uuid NULL,
    ""RoleFilaId"" uuid NULL,
    ""Ativo"" boolean NOT NULL DEFAULT true,
    ""UpdatedAtUtc"" timestamptz NOT NULL,
    CONSTRAINT ""PK_EtapasConfigAprovacao"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_EtapasConfigAprovacao_Funcionarios""
        FOREIGN KEY (""FuncionarioFixoId"") REFERENCES ""Funcionarios""(""Id"") ON DELETE SET NULL,
    CONSTRAINT ""FK_EtapasConfigAprovacao_Roles""
        FOREIGN KEY (""RoleFilaId"") REFERENCES ""Roles""(""Id"") ON DELETE SET NULL
);

-- SolicitacoesAprovacaoEtapas
CREATE TABLE IF NOT EXISTS ""SolicitacoesAprovacaoEtapas"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" text NOT NULL,
    ""SolicitacaoId"" uuid NOT NULL,
    ""TipoFluxo"" smallint NOT NULL,
    ""Ordem"" integer NOT NULL,
    ""Label"" character varying(120) NOT NULL DEFAULT '',
    ""AprovadorId"" uuid NULL,
    ""RoleFilaId"" uuid NULL,
    ""Status"" smallint NOT NULL DEFAULT 0,
    ""Observacao"" text NULL,
    ""DataUtc"" timestamptz NULL,
    CONSTRAINT ""PK_SolicitacoesAprovacaoEtapas"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_SolicitacoesAprovacaoEtapas_Funcionarios""
        FOREIGN KEY (""AprovadorId"") REFERENCES ""Funcionarios""(""Id"") ON DELETE SET NULL
);

END $$;

-- Indexes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_EtapasConfigAprovacao_TenantId_TipoFluxo_Ordem""
    ON ""EtapasConfigAprovacao"" (""TenantId"", ""TipoFluxo"", ""Ordem"");

CREATE INDEX IF NOT EXISTS ""IX_SolicitacoesAprovacaoEtapas_Solicitacao""
    ON ""SolicitacoesAprovacaoEtapas"" (""TenantId"", ""SolicitacaoId"", ""TipoFluxo"");

CREATE INDEX IF NOT EXISTS ""IX_SolicitacoesAprovacaoEtapas_FilaPendente""
    ON ""SolicitacoesAprovacaoEtapas"" (""TenantId"", ""RoleFilaId"", ""Status"")
    WHERE ""RoleFilaId"" IS NOT NULL;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""SolicitacoesAprovacaoEtapas"";
DROP TABLE IF EXISTS ""EtapasConfigAprovacao"";
");
        }
    }
}
