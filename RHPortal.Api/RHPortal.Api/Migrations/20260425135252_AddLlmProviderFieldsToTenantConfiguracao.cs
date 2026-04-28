using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Migration da Fase 3 do épico LLM-agnóstico: adiciona 4 colunas em
    /// <c>TenantConfiguracoes</c> para que cada tenant escolha seu próprio
    /// provider de LLM e embeddings.
    ///
    /// <para>
    /// O scaffolding do EF Core gerou uma migration "grande" porque o
    /// <c>AppDbContextModelSnapshot.cs</c> estava dessincronizado de várias
    /// migrations anteriores (drift histórico). Como os bancos atuais já
    /// têm todas essas colunas/tabelas, e o snapshot precisa refletir o
    /// modelo real, todas as operações foram convertidas para SQL puro
    /// idempotente (<c>IF NOT EXISTS</c>) — conforme <c>CLAUDE.md</c>:
    /// </para>
    /// <code>
    /// migrationBuilder.Sql("""
    ///     ALTER TABLE "Tabela" ADD COLUMN IF NOT EXISTS "Coluna" tipo NULL;
    ///     """);
    /// </code>
    /// <para>
    /// Resultado: bancos existentes ganham apenas as 4 novas colunas Llm/Embedding,
    /// bancos novos provisionados ganham todo o schema deste ponto adiante.
    /// </para>
    /// </summary>
    public partial class AddLlmProviderFieldsToTenantConfiguracao : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ────────────────────────────────────────────────────────────────
            // FOCO DA FASE 3 — 4 colunas novas em TenantConfiguracoes
            // ────────────────────────────────────────────────────────────────
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "LlmProvider"        text NULL;
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "LlmModel"           text NULL;
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "EmbeddingProvider"  text NULL;
                ALTER TABLE "TenantConfiguracoes" ADD COLUMN IF NOT EXISTS "EmbeddingModel"     text NULL;
                """);

            // ────────────────────────────────────────────────────────────────
            // Demais colunas do drift do snapshot — todas idempotentes.
            // Sem comentários repetidos: cada uma é ADD COLUMN IF NOT EXISTS.
            // ────────────────────────────────────────────────────────────────
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas"                ADD COLUMN IF NOT EXISTS "HeadcountPendente" integer NOT NULL DEFAULT 0;

                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "AzureAdClientId"          text NULL;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "AzureAdClientSecret"      text NULL;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "AzureAdTenantId"          text NULL;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "BlipApiKey"               text NULL;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "BlipApiUrl"               text NULL;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "BlipNumeroHospedeiro"     text NULL;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "BloqueiaSalarioForaFaixa" boolean NOT NULL DEFAULT false;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "SlaAprovacaoHoras"        integer NOT NULL DEFAULT 0;
                ALTER TABLE "TenantConfiguracoes"  ADD COLUMN IF NOT EXISTS "SlaEscalacaoHoras"        integer NOT NULL DEFAULT 0;

                ALTER TABLE "SolicitacoesVaga"     ADD COLUMN IF NOT EXISTS "CandidatoContratadoId"        uuid NULL;
                ALTER TABLE "SolicitacoesVaga"     ADD COLUMN IF NOT EXISTS "DataDesligamento"             date NULL;
                ALTER TABLE "SolicitacoesVaga"     ADD COLUMN IF NOT EXISTS "DesligamentoVinculadoId"      uuid NULL;
                ALTER TABLE "SolicitacoesVaga"     ADD COLUMN IF NOT EXISTS "DiasAvisoPrevioDesligamento"  integer NULL;
                ALTER TABLE "SolicitacoesVaga"     ADD COLUMN IF NOT EXISTS "MotivoDesligamentoTexto"      character varying(2000) NULL;
                ALTER TABLE "SolicitacoesVaga"     ADD COLUMN IF NOT EXISTS "PossuiEstabilidadeDesligamento" boolean NULL;
                ALTER TABLE "SolicitacoesVaga"     ADD COLUMN IF NOT EXISTS "TipoAvisoPrevioDesligamento"  smallint NULL;

                ALTER TABLE "SolicitacoesDesligamento" ADD COLUMN IF NOT EXISTS "SolicitacaoVagaOrigemId" uuid NULL;

                ALTER TABLE "PreAdmissoes"         ADD COLUMN IF NOT EXISTS "RequisitoCategoriaId"     uuid NULL;
                ALTER TABLE "Funcionarios"         ADD COLUMN IF NOT EXISTS "Sexo"                     character varying(1) NULL;
                """);

            // AlterColumn em PreAdmissoes (int → date) precisa de USING quando há dados.
            // Idempotente: só altera se o tipo atual ainda for integer.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes'
                          AND column_name = 'CnhPrimeiraHabilitacao'
                          AND data_type = 'integer'
                    ) THEN
                        ALTER TABLE "PreAdmissoes"
                            ALTER COLUMN "CnhPrimeiraHabilitacao" DROP DEFAULT,
                            ALTER COLUMN "CnhPrimeiraHabilitacao" TYPE date USING NULL,
                            ALTER COLUMN "CnhPrimeiraHabilitacao" DROP NOT NULL;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'PreAdmissoes'
                          AND column_name = 'CnhDataExpedicao'
                          AND data_type = 'integer'
                    ) THEN
                        ALTER TABLE "PreAdmissoes"
                            ALTER COLUMN "CnhDataExpedicao" DROP DEFAULT,
                            ALTER COLUMN "CnhDataExpedicao" TYPE date USING NULL,
                            ALTER COLUMN "CnhDataExpedicao" DROP NOT NULL;
                    END IF;
                END $$;
                """);

            // Tabela DadosBancarios + índice + FK (idempotentes)
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DadosBancarios" (
                    "Id"            uuid                       NOT NULL,
                    "TenantId"      text                       NOT NULL,
                    "FuncionarioId" uuid                       NOT NULL,
                    "Banco"         character varying(200)     NOT NULL,
                    "Agencia"       character varying(20)      NOT NULL,
                    "Conta"         character varying(30)      NOT NULL,
                    "TipoConta"     smallint                   NOT NULL,
                    "Pix"           character varying(150)     NULL,
                    "CreatedAtUtc"  timestamp with time zone   NOT NULL,
                    "UpdatedAtUtc"  timestamp with time zone   NOT NULL,
                    CONSTRAINT "PK_DadosBancarios" PRIMARY KEY ("Id")
                );

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_DadosBancarios_Funcionarios_FuncionarioId') THEN
                        ALTER TABLE "DadosBancarios"
                            ADD CONSTRAINT "FK_DadosBancarios_Funcionarios_FuncionarioId"
                            FOREIGN KEY ("FuncionarioId")
                            REFERENCES "Funcionarios" ("Id")
                            ON DELETE CASCADE;
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS "IX_DadosBancarios_FuncionarioId"
                    ON "DadosBancarios" ("FuncionarioId");

                CREATE INDEX IF NOT EXISTS "IX_SolicitacoesVaga_CandidatoContratadoId"
                    ON "SolicitacoesVaga" ("CandidatoContratadoId");

                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SolicitacoesVaga_Candidatos_CandidatoContratadoId') THEN
                        ALTER TABLE "SolicitacoesVaga"
                            ADD CONSTRAINT "FK_SolicitacoesVaga_Candidatos_CandidatoContratadoId"
                            FOREIGN KEY ("CandidatoContratadoId")
                            REFERENCES "Candidatos" ("Id");
                    END IF;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Down conservador: reverte apenas as 4 colunas novas da Fase 3.
            // Não tocamos no resto (drift do snapshot) — quem quiser desfazer
            // mais coisas pode escrever uma migration de rollback explícita.
            migrationBuilder.Sql("""
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "EmbeddingModel";
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "EmbeddingProvider";
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "LlmModel";
                ALTER TABLE "TenantConfiguracoes" DROP COLUMN IF EXISTS "LlmProvider";
                """);
        }
    }
}
