using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRmRequisicaoPareceres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                ADD COLUMN IF NOT EXISTS "RmRequisicaoParecerEndpointUrl" character varying(1000) NULL;
                """);

            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "RmRequisicaoPareceres" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "SolicitacaoVagaId" uuid NULL,
                    "TipoRequisicao" character varying(60) NOT NULL,
                    "CodColRequisicao" smallint NOT NULL,
                    "IdReq" integer NOT NULL,
                    "IdParecer" integer NOT NULL,
                    "DataParecer" timestamp with time zone NULL,
                    "CodStatus" smallint NULL,
                    "Suspensao" smallint NULL,
                    "Solicitante" character varying(200) NULL,
                    "Img1" smallint NULL,
                    "CodColSolicitante" smallint NULL,
                    "ChapaSolicitante" character varying(30) NULL,
                    "Parecer" character varying(4000) NULL,
                    "Status" character varying(120) NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_RmRequisicaoPareceres" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_RmRequisicaoPareceres_SolicitacoesVaga_SolicitacaoVagaId"
                        FOREIGN KEY ("SolicitacaoVagaId") REFERENCES "SolicitacoesVaga" ("Id") ON DELETE SET NULL
                );
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_RmRequisicaoPareceres_SolicitacaoVagaId"
                ON "RmRequisicaoPareceres" ("SolicitacaoVagaId");
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_RmRequisicaoPareceres_TenantId_SolicitacaoVagaId_DataParecer"
                ON "RmRequisicaoPareceres" ("TenantId", "SolicitacaoVagaId", "DataParecer");
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_RmRequisicaoPareceres_TenantId_TipoRequisicao_CodColRequisi~"
                ON "RmRequisicaoPareceres" ("TenantId", "TipoRequisicao", "CodColRequisicao", "IdReq", "IdParecer");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "RmRequisicaoPareceres";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes"
                DROP COLUMN IF EXISTS "RmRequisicaoParecerEndpointUrl";
                """);
        }
    }
}
