using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEntrevistasSaida : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "TemplatesEntrevistaSaida" (
                    "Id"           uuid                        NOT NULL,
                    "TenantId"     character varying(64)       NOT NULL,
                    "Nome"         character varying(120)      NOT NULL,
                    "Ativo"        boolean                     NOT NULL DEFAULT false,
                    "CreatedAtUtc" timestamp with time zone    NOT NULL,
                    CONSTRAINT "PK_TemplatesEntrevistaSaida" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "PerguntasEntrevistaSaida" (
                    "Id"           uuid                        NOT NULL,
                    "TenantId"     character varying(64)       NOT NULL,
                    "TemplateId"   uuid                        NOT NULL,
                    "Ordem"        integer                     NOT NULL,
                    "Texto"        character varying(500)      NOT NULL,
                    "TipoResposta" smallint                    NOT NULL,
                    "Opcoes"       character varying(1000)     NULL,
                    "Obrigatoria"  boolean                     NOT NULL DEFAULT false,
                    CONSTRAINT "PK_PerguntasEntrevistaSaida" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_PerguntasEntrevistaSaida_TemplatesEntrevistaSaida_TemplateId"
                        FOREIGN KEY ("TemplateId") REFERENCES "TemplatesEntrevistaSaida" ("Id") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS "EntrevistasSaida" (
                    "Id"             uuid                        NOT NULL,
                    "TenantId"       character varying(64)       NOT NULL,
                    "DesligamentoId" uuid                        NOT NULL,
                    "FuncionarioId"  uuid                        NOT NULL,
                    "TemplateId"     uuid                        NOT NULL,
                    "Token"          character varying(64)       NOT NULL,
                    "ExpiresAtUtc"   timestamp with time zone    NOT NULL,
                    "SubmittedAtUtc" timestamp with time zone    NULL,
                    "CreatedAtUtc"   timestamp with time zone    NOT NULL,
                    CONSTRAINT "PK_EntrevistasSaida" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "RespostasEntrevistaSaida" (
                    "Id"          uuid                        NOT NULL,
                    "TenantId"    character varying(64)       NOT NULL,
                    "EntrevistaId" uuid                       NOT NULL,
                    "PerguntaId"  uuid                        NOT NULL,
                    "ValorTexto"  character varying(2000)     NULL,
                    "ValorEscala" integer                     NULL,
                    "ValorOpcao"  character varying(200)      NULL,
                    CONSTRAINT "PK_RespostasEntrevistaSaida" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_RespostasEntrevistaSaida_EntrevistasSaida_EntrevistaId"
                        FOREIGN KEY ("EntrevistaId") REFERENCES "EntrevistasSaida" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_RespostasEntrevistaSaida_PerguntasEntrevistaSaida_PerguntaId"
                        FOREIGN KEY ("PerguntaId") REFERENCES "PerguntasEntrevistaSaida" ("Id") ON DELETE RESTRICT
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_EntrevistasSaida_TenantId_DesligamentoId"
                    ON "EntrevistasSaida" ("TenantId", "DesligamentoId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_EntrevistasSaida_TenantId_Token"
                    ON "EntrevistasSaida" ("TenantId", "Token");
                CREATE INDEX IF NOT EXISTS "IX_PerguntasEntrevistaSaida_TemplateId"
                    ON "PerguntasEntrevistaSaida" ("TemplateId");
                CREATE INDEX IF NOT EXISTS "IX_PerguntasEntrevistaSaida_TenantId_TemplateId_Ordem"
                    ON "PerguntasEntrevistaSaida" ("TenantId", "TemplateId", "Ordem");
                CREATE INDEX IF NOT EXISTS "IX_RespostasEntrevistaSaida_EntrevistaId"
                    ON "RespostasEntrevistaSaida" ("EntrevistaId");
                CREATE INDEX IF NOT EXISTS "IX_RespostasEntrevistaSaida_PerguntaId"
                    ON "RespostasEntrevistaSaida" ("PerguntaId");
                CREATE INDEX IF NOT EXISTS "IX_RespostasEntrevistaSaida_TenantId_EntrevistaId"
                    ON "RespostasEntrevistaSaida" ("TenantId", "EntrevistaId");
                CREATE INDEX IF NOT EXISTS "IX_TemplatesEntrevistaSaida_TenantId_Ativo"
                    ON "TemplatesEntrevistaSaida" ("TenantId", "Ativo");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RespostasEntrevistaSaida");

            migrationBuilder.DropTable(
                name: "EntrevistasSaida");

            migrationBuilder.DropTable(
                name: "PerguntasEntrevistaSaida");

            migrationBuilder.DropTable(
                name: "TemplatesEntrevistaSaida");
        }
    }
}
