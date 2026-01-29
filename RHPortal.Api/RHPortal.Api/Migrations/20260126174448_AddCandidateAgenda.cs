using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateAgenda : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""CandidatoAgendaPreferencias"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" character varying(64) NOT NULL,
    ""CandidatoId"" uuid NOT NULL,
    ""FormatoEntrevista"" character varying(40),
    ""InicioDisponivel"" character varying(40),
    ""AvisoPrevio"" character varying(40),
    ""Observacoes"" character varying(400),
    ""DiaSeg"" boolean NOT NULL DEFAULT FALSE,
    ""DiaTer"" boolean NOT NULL DEFAULT FALSE,
    ""DiaQua"" boolean NOT NULL DEFAULT FALSE,
    ""DiaQui"" boolean NOT NULL DEFAULT FALSE,
    ""DiaSex"" boolean NOT NULL DEFAULT FALSE,
    ""DiaSab"" boolean NOT NULL DEFAULT FALSE,
    ""DiaDom"" boolean NOT NULL DEFAULT FALSE,
    ""PeriodoManha"" boolean NOT NULL DEFAULT FALSE,
    ""PeriodoTarde"" boolean NOT NULL DEFAULT FALSE,
    ""PeriodoNoite"" boolean NOT NULL DEFAULT FALSE,
    ""HorarioPreferido"" character varying(40),
    ""FusoHorario"" character varying(60),
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_CandidatoAgendaPreferencias"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_CandidatoAgendaPreferencias_Candidatos_CandidatoId"" FOREIGN KEY (""CandidatoId"") REFERENCES ""Candidatos"" (""Id"") ON DELETE CASCADE
);
");

            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_CandidatoAgendaPreferencias_CandidatoId"" ON ""CandidatoAgendaPreferencias"" (""CandidatoId"");");
            migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_CandidatoAgendaPreferencias_TenantId_CandidatoId"" ON ""CandidatoAgendaPreferencias"" (""TenantId"", ""CandidatoId"");");

            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""CandidatoAgendaBloqueios"" (
    ""Id"" uuid NOT NULL,
    ""TenantId"" character varying(64) NOT NULL,
    ""CandidatoId"" uuid NOT NULL,
    ""Tipo"" character varying(40),
    ""Titulo"" character varying(120),
    ""Data"" character varying(40),
    ""Horario"" character varying(40),
    ""Observacoes"" character varying(400),
    ""CreatedAtUtc"" timestamp with time zone NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_CandidatoAgendaBloqueios"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_CandidatoAgendaBloqueios_Candidatos_CandidatoId"" FOREIGN KEY (""CandidatoId"") REFERENCES ""Candidatos"" (""Id"") ON DELETE CASCADE
);
");

            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_CandidatoAgendaBloqueios_CandidatoId"" ON ""CandidatoAgendaBloqueios"" (""CandidatoId"");");
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_CandidatoAgendaBloqueios_TenantId_CandidatoId"" ON ""CandidatoAgendaBloqueios"" (""TenantId"", ""CandidatoId"");");
        }





        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""CandidatoAgendaBloqueios"";");
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""CandidatoAgendaPreferencias"";");
        }




    }
}
