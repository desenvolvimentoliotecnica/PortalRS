using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <summary>
    /// Sessão 31.8 (FASE 1.A + 1.B + 1.E) — Estrutura de matching profundo.
    ///
    /// Adiciona em <c>DescricoesCargo</c> os campos do template DNALIO
    /// (Área/CBO/Formação/Experiência/Revisão); cria tabela filha
    /// <c>DescricaoCargoItens</c> (Atividades/Vivências/Competências/Requisitos
    /// estruturados); estende <c>Vagas</c> com <c>DescricaoCargoId</c> + 3 pesos
    /// novos (Idioma, ConhecimentoTecnico, VivenciaEspecifica) +
    /// <c>LocalidadeMaxDistanciaKm</c>; estende <c>Empresas</c> com endereço
    /// completo + lat/lng/timestamp de geocodificação; estende <c>Pessoas</c>
    /// com lat/lng/timestamp.
    ///
    /// Migration idempotente — <c>ADD COLUMN IF NOT EXISTS</c>, <c>CREATE TABLE
    /// IF NOT EXISTS</c>, <c>CREATE INDEX IF NOT EXISTS</c>, FK via
    /// <c>DO $$ pg_constraint $$</c>. Re-executável em qualquer estágio.
    /// </summary>
    public partial class AddDescricaoCargoDnalioGeocodingPesos : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Vagas: pesos novos + localidade max km + FK p/ DescricaoCargo
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "PesoIdioma"              integer NOT NULL DEFAULT 0;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "PesoConhecimentoTecnico" integer NOT NULL DEFAULT 0;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "PesoVivenciaEspecifica"  integer NOT NULL DEFAULT 0;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "LocalidadeMaxDistanciaKm" integer NULL;
                ALTER TABLE "Vagas" ADD COLUMN IF NOT EXISTS "DescricaoCargoId"        uuid NULL;
                """);

            // ── 2. Pessoas: lat/lng + timestamp de geocodificação
            migrationBuilder.Sql("""
                ALTER TABLE "Pessoas" ADD COLUMN IF NOT EXISTS "Latitude"            numeric NULL;
                ALTER TABLE "Pessoas" ADD COLUMN IF NOT EXISTS "Longitude"           numeric NULL;
                ALTER TABLE "Pessoas" ADD COLUMN IF NOT EXISTS "GeocodificadoEmUtc"  timestamp with time zone NULL;
                """);

            // ── 3. Empresas: endereço completo + lat/lng + timestamp
            migrationBuilder.Sql("""
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Cep"                character varying(20)  NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Logradouro"         character varying(200) NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Numero"             character varying(40)  NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Bairro"             character varying(120) NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Cidade"             character varying(120) NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Uf"                 character varying(2)   NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Latitude"           numeric NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "Longitude"          numeric NULL;
                ALTER TABLE "Empresas" ADD COLUMN IF NOT EXISTS "GeocodificadoEmUtc" timestamp with time zone NULL;
                """);

            // ── 4. DescricoesCargo: campos do template DNALIO (cabeçalho, formação, experiência, revisão)
            migrationBuilder.Sql("""
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "AreaTemplate"              character varying(120) NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "CboCodigo"                 character varying(20)  NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "FormacaoMinima"            character varying(200) NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "FormacaoDesejavel"         character varying(200) NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "FormacaoAreaEstudo"        character varying(200) NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "ExperienciaTempoMinimo"    character varying(80)  NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "ExperienciaTempoDesejavel" character varying(80)  NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "ExperienciaEspecificacao"  character varying(500) NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "RevisaoNumero"             character varying(10)  NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "RevisaoData"               date NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "RevisaoNatureza"           character varying(200) NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "GestorNome"                character varying(200) NULL;
                ALTER TABLE "DescricoesCargo" ADD COLUMN IF NOT EXISTS "GestorEmail"               character varying(200) NULL;
                """);

            // ── 5. DescricaoCargoItens (tabela filha — atividades/vivências/competências/requisitos)
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "DescricaoCargoItens" (
                    "Id"                uuid                       NOT NULL,
                    "TenantId"          character varying(64)      NOT NULL,
                    "DescricaoCargoId"  uuid                       NOT NULL,
                    "Categoria"         smallint                   NOT NULL,
                    "Texto"             character varying(500)     NOT NULL,
                    "IsObrigatoria"     boolean                    NOT NULL DEFAULT true,
                    "NivelMinimo"       character varying(40)      NULL,
                    "Subcategoria"      character varying(80)      NULL,
                    "Ordem"             integer                    NOT NULL DEFAULT 0,
                    "CreatedAtUtc"      timestamp with time zone   NOT NULL DEFAULT NOW(),
                    "UpdatedAtUtc"      timestamp with time zone   NOT NULL DEFAULT NOW(),
                    CONSTRAINT "PK_DescricaoCargoItens" PRIMARY KEY ("Id")
                );
                """);

            // ── 6. Índices da tabela filha
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_DescricaoCargoItens_DescricaoCargoId"
                    ON "DescricaoCargoItens" ("DescricaoCargoId");
                CREATE INDEX IF NOT EXISTS "IX_DescricaoCargoItens_TenantId_DescricaoCargoId"
                    ON "DescricaoCargoItens" ("TenantId", "DescricaoCargoId");
                CREATE INDEX IF NOT EXISTS "IX_DescricaoCargoItens_TenantId_DescricaoCargoId_Categoria"
                    ON "DescricaoCargoItens" ("TenantId", "DescricaoCargoId", "Categoria");
                CREATE INDEX IF NOT EXISTS "IX_Vagas_DescricaoCargoId"
                    ON "Vagas" ("DescricaoCargoId");
                """);

            // ── 7. FKs (Cascade DescricaoCargoItens → DescricaoCargo, SetNull Vagas → DescricaoCargo)
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                                   WHERE conname = 'FK_DescricaoCargoItens_DescricoesCargo_DescricaoCargoId') THEN
                        ALTER TABLE "DescricaoCargoItens"
                            ADD CONSTRAINT "FK_DescricaoCargoItens_DescricoesCargo_DescricaoCargoId"
                            FOREIGN KEY ("DescricaoCargoId") REFERENCES "DescricoesCargo" ("Id") ON DELETE CASCADE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                                   WHERE conname = 'FK_Vagas_DescricoesCargo_DescricaoCargoId') THEN
                        ALTER TABLE "Vagas"
                            ADD CONSTRAINT "FK_Vagas_DescricoesCargo_DescricaoCargoId"
                            FOREIGN KEY ("DescricaoCargoId") REFERENCES "DescricoesCargo" ("Id") ON DELETE SET NULL;
                    END IF;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Vagas" DROP CONSTRAINT IF EXISTS "FK_Vagas_DescricoesCargo_DescricaoCargoId";
                DROP TABLE IF EXISTS "DescricaoCargoItens" CASCADE;
                ALTER TABLE "Vagas"           DROP COLUMN IF EXISTS "DescricaoCargoId";
                ALTER TABLE "Vagas"           DROP COLUMN IF EXISTS "PesoIdioma";
                ALTER TABLE "Vagas"           DROP COLUMN IF EXISTS "PesoConhecimentoTecnico";
                ALTER TABLE "Vagas"           DROP COLUMN IF EXISTS "PesoVivenciaEspecifica";
                ALTER TABLE "Vagas"           DROP COLUMN IF EXISTS "LocalidadeMaxDistanciaKm";
                ALTER TABLE "Pessoas"         DROP COLUMN IF EXISTS "Latitude";
                ALTER TABLE "Pessoas"         DROP COLUMN IF EXISTS "Longitude";
                ALTER TABLE "Pessoas"         DROP COLUMN IF EXISTS "GeocodificadoEmUtc";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Cep";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Logradouro";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Numero";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Bairro";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Cidade";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Uf";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Latitude";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "Longitude";
                ALTER TABLE "Empresas"        DROP COLUMN IF EXISTS "GeocodificadoEmUtc";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "AreaTemplate";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "CboCodigo";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "FormacaoMinima";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "FormacaoDesejavel";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "FormacaoAreaEstudo";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "ExperienciaTempoMinimo";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "ExperienciaTempoDesejavel";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "ExperienciaEspecificacao";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "RevisaoNumero";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "RevisaoData";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "RevisaoNatureza";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "GestorNome";
                ALTER TABLE "DescricoesCargo" DROP COLUMN IF EXISTS "GestorEmail";
                """);
        }
    }
}
