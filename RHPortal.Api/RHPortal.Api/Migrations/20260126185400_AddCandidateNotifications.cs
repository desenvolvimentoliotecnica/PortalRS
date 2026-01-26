using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateNotifications : Migration
    {
        /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""CandidatoNotificacaoPreferencias"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" character varying(64) NOT NULL,
    ""CandidatoId"" uuid NOT NULL,
    ""CanalEmail"" boolean NOT NULL,
    ""CanalWhatsapp"" boolean NOT NULL,
    ""CanalSms"" boolean NOT NULL,
    ""CanalPush"" boolean NOT NULL,
    ""Frequencia"" character varying(40) NULL,
    ""Idioma"" character varying(20) NULL,
    ""Email"" character varying(180) NULL,
    ""Telefone"" character varying(40) NULL,
    ""PermiteContato"" boolean NOT NULL,
    ""AlertaNovasVagas"" boolean NOT NULL,
    ""AlertaAtualizacoes"" boolean NOT NULL,
    ""AlertaEntrevistas"" boolean NOT NULL,
    ""AlertaMensagens"" boolean NOT NULL,
    ""AlertaDocumentos"" boolean NOT NULL,
    ""AlertaLembretes"" boolean NOT NULL,
    ""SilencioAtivo"" character varying(10) NULL,
    ""SilencioInicio"" character varying(10) NULL,
    ""SilencioFim"" character varying(10) NULL,
    ""SilencioPrioridade"" character varying(20) NULL,
    ""Assinatura"" character varying(200) NULL,
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_CandidatoNotificacaoPreferencias"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_CandidatoNotificacaoPreferencias_Candidatos_CandidatoId"" FOREIGN KEY (""CandidatoId"") REFERENCES ""Candidatos"" (""Id"") ON DELETE CASCADE
);");

        migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_CandidatoNotificacaoPreferencias_CandidatoId"" ON ""CandidatoNotificacaoPreferencias"" (""CandidatoId"");");
        migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_CandidatoNotificacaoPreferencias_TenantId_CandidatoId"" ON ""CandidatoNotificacaoPreferencias"" (""TenantId"", ""CandidatoId"");");
    }

        /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""CandidatoNotificacaoPreferencias"";");
    }
    }
}
