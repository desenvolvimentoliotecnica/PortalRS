using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantRmConfiguracao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "TenantRmConfiguracoes" (
                    "Id" uuid NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "SqlServer" character varying(200) NULL,
                    "SqlDatabase" character varying(200) NULL,
                    "SqlUserId" character varying(200) NULL,
                    "SqlPasswordEncrypted" character varying(1000) NULL,
                    "SqlEncrypt" boolean NOT NULL DEFAULT TRUE,
                    "SqlTrustServerCertificate" boolean NOT NULL DEFAULT TRUE,
                    "SqlConnectTimeoutSeconds" integer NOT NULL DEFAULT 15,
                    "SqlApplicationIntent" character varying(40) NULL DEFAULT 'ReadOnly',
                    "Mode" character varying(40) NOT NULL DEFAULT 'stub',
                    "CreateEndpointUrl" character varying(1000) NULL,
                    "GetEndpointUrl" character varying(1000) NULL,
                    "ParecerEndpointUrl" character varying(1000) NULL,
                    "RequestTimeoutSeconds" integer NOT NULL DEFAULT 60,
                    "RestUsername" character varying(200) NULL,
                    "RestPasswordEncrypted" character varying(1000) NULL,
                    "RestBearerTokenEncrypted" character varying(2000) NULL,
                    "MaxTentativas" integer NOT NULL DEFAULT 5,
                    "CreateWorkerEnabled" boolean NOT NULL DEFAULT TRUE,
                    "CreateWorkerIntervalSeconds" integer NOT NULL DEFAULT 30,
                    "CreateWorkerMaxPerTenant" integer NOT NULL DEFAULT 20,
                    "CodColRequisicaoDefault" smallint NULL DEFAULT 1,
                    "CodColRequisitanteDefault" smallint NULL,
                    "CodStatusInicial" smallint NOT NULL DEFAULT 1,
                    "CodLocalDefault" integer NULL DEFAULT 1,
                    "CodFilialDefault" smallint NULL,
                    "DiasPrevisaoPadrao" integer NOT NULL DEFAULT 5,
                    "RecCreatedBy" character varying(60) NOT NULL DEFAULT 'portal',
                    "RecModifiedBy" character varying(60) NOT NULL DEFAULT 'portal',
                    "RequisicoesVagaOrigemRm" boolean NOT NULL DEFAULT FALSE,
                    "ImportacaoAutomaticaAtiva" boolean NOT NULL DEFAULT FALSE,
                    "ImportacaoAutomaticaIntervaloMinutos" integer NOT NULL DEFAULT 15,
                    "ImportacaoAutomaticaMaxPorExecucao" integer NOT NULL DEFAULT 50,
                    "StatusSyncEnabled" boolean NOT NULL DEFAULT FALSE,
                    "StatusSyncIntervalMinutes" integer NOT NULL DEFAULT 15,
                    "StatusSyncMaxPerRun" integer NOT NULL DEFAULT 50,
                    "SyncUnits" boolean NOT NULL DEFAULT TRUE,
                    "SyncUnitsExecute" boolean NOT NULL DEFAULT TRUE,
                    "SyncVagas" boolean NOT NULL DEFAULT TRUE,
                    "SyncVagasOnly" boolean NOT NULL DEFAULT FALSE,
                    "SyncEmpresas" boolean NOT NULL DEFAULT TRUE,
                    "SyncHierarquia" boolean NOT NULL DEFAULT TRUE,
                    "SyncDesligamentos" boolean NOT NULL DEFAULT TRUE,
                    "SyncCandidatosVagaDiagnostic" boolean NOT NULL DEFAULT TRUE,
                    "SyncCandidatosVaga" boolean NOT NULL DEFAULT TRUE,
                    "SyncCandidatosPerfilCv" boolean NOT NULL DEFAULT TRUE,
                    "UseGestorHierarquiaPosicao" boolean NOT NULL DEFAULT TRUE,
                    "UseHierarquiaOrganogramaPosicao" boolean NOT NULL DEFAULT TRUE,
                    "MaxTalentosToSync" integer NULL,
                    "MaxCandidatosToSync" integer NULL,
                    "MaxPessoasToSync" integer NULL,
                    "MaxFuncionariosToSync" integer NULL,
                    "SyncOnlyEmail" character varying(240) NULL,
                    "VagaDefaultAreaCode" character varying(80) NULL,
                    "Schema" character varying(80) NOT NULL DEFAULT 'dbo',
                    "AreaTable" character varying(160) NOT NULL DEFAULT 'BAREA',
                    "DepartamentoTable" character varying(160) NOT NULL DEFAULT 'PSECAO',
                    "FuncaoTable" character varying(160) NOT NULL DEFAULT 'PFUNCAO',
                    "CargoTable" character varying(160) NOT NULL DEFAULT 'PCARGO',
                    "VagaTable" character varying(160) NOT NULL DEFAULT 'VRSVAGAS',
                    "UnidadeTable" character varying(160) NOT NULL DEFAULT 'GFILIAL',
                    "FuncionarioTable" character varying(160) NOT NULL DEFAULT 'PFUNC',
                    "PessoaTable" character varying(160) NOT NULL DEFAULT 'PPESSOA',
                    "HierarquiaTable" character varying(160) NOT NULL DEFAULT 'VHIERARQUIA',
                    "HierarquiaColigadaExternaTable" character varying(160) NULL DEFAULT 'VHIERARQUIACOLIGADAEXTERNA',
                    "DesligamentoTable" character varying(160) NOT NULL DEFAULT 'VREQDESLIGAMENTO',
                    "AumentoQuadroTable" character varying(160) NOT NULL DEFAULT 'VREQAUMENTOQUADRO',
                    "SubstituicaoTable" character varying(160) NOT NULL DEFAULT 'VREQSUBSTITUICAO',
                    "TransferenciaPromocaoTable" character varying(160) NOT NULL DEFAULT 'VREQTRANSFPROMOCAO',
                    "GestoresRmUrlTemplate" character varying(2048) NULL,
                    "GestoresRmUser" character varying(200) NULL,
                    "GestoresRmPasswordEncrypted" character varying(1000) NULL,
                    "GestoresRmDefaultCodColigada" smallint NOT NULL DEFAULT 1,
                    "GestoresRmDelayMsBetweenRequests" integer NOT NULL DEFAULT 250,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_TenantRmConfiguracoes" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantRmConfiguracoes_TenantId"
                    ON "TenantRmConfiguracoes" ("TenantId");

                INSERT INTO "TenantRmConfiguracoes" (
                    "Id", "TenantId", "CreateEndpointUrl", "GetEndpointUrl", "ParecerEndpointUrl", "RestUsername",
                    "RequisicoesVagaOrigemRm", "ImportacaoAutomaticaAtiva",
                    "ImportacaoAutomaticaIntervaloMinutos", "ImportacaoAutomaticaMaxPorExecucao", "UpdatedAtUtc"
                )
                SELECT
                    gen_random_uuid(),
                    c."TenantId",
                    c."RmRequisicaoCreateEndpointUrl",
                    c."RmRequisicaoGetEndpointUrl",
                    c."RmRequisicaoParecerEndpointUrl",
                    c."RmRequisicaoCreateUsername",
                    c."RequisicoesVagaOrigemRm",
                    c."RmImportacaoAutomaticaAtiva",
                    c."RmImportacaoAutomaticaIntervaloMinutos",
                    c."RmImportacaoAutomaticaMaxPorExecucao",
                    NOW()
                FROM "TenantConfiguracoes" c
                WHERE NOT EXISTS (
                    SELECT 1 FROM "TenantRmConfiguracoes" rm WHERE rm."TenantId" = c."TenantId"
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TABLE IF EXISTS "TenantRmConfiguracoes";
                """);
        }
    }
}
