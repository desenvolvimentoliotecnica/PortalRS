using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RhPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPreAdmissaoExtendedFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: covers columns from AddTotvsFieldsCompleto that failed on older tenant DBs
            // (non-idempotent AddColumn in that migration caused partial failure) + brand-new entity fields.
            migrationBuilder.Sql("""
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Avos13SalCalc" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Avos13SalCalcAnterior" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Cabelo" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Calcula13" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CargaAutomTurno" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CategoriaTrabalhoESocial" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CnhDataExpedicao" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CnhNumero" character varying(20) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CnhOrgaoEmissor" character varying(20) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CnhPrimeiraHabilitacao" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CnhUf" character varying(2) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodClassFuncPontoEletronico" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodEmpresa" character varying(10) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodFpas" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodLocalMarcacao" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodLocalidade" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodNivel" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodPlanoLotacao" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodSindicato" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodTurma" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ConsidEmissRAIS" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ContribSindicDia" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CtpsSerieESocial" character varying(10) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Cutis" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DescContribSindical" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DiasProvFeriasMesAnterior" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DiasProvFeriasMesAtual" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "EmitCartPonto" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "FormaPagamento" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "FuncDoador" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "FuncQualificado" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "IndAdmissao" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "IndFuncVinculado" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Manequim" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "MatriculaESocial" character varying(30) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "MunicipioNascimentoIbge" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "NaturezaAtividade" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "NumCartaoPonto" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Olhos" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "OptanteFgts" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "OrigemFuncionario" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "PaisLocalidade" character varying(10) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ProvAcum13Sal" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ProvAcumFerias" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ProvAcumFerias13" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ProvAcumFgts13Sal" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ProvAcumFgtsFerias" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ProvAcumInss13Sal" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ProvAcumInssFerias" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RecebeAdiantamento" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RecebeFerias" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RecebeInsalub" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RecebePericul" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RecolheFgts" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RecolheInss" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegimeJornada" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RgUfExpedidor" character varying(2) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "SalarioSimulado" numeric NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Sapato" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Sindicalizado" character varying(1) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoAdmissaoFgts" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoMaoDeObra" character varying(10) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "NomeAbreviado" character varying(20) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "EmailAlternativo" character varying(180) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DddTelefone" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DddTelContato" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "MunicipioEnderecoIbge" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoLogradouroESocial" character varying(5) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "PaisNascimento" character varying(10) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoVistoEstrangeiro" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DataTerminoContrato" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoAdmissaoESocial" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "OcorrenciaCAGED" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "PontoReferencia" character varying(120) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegimeTrabalhista" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "RegimePrevidenciario" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "AnoChegada" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CidadeExterior" character varying(120) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "CodEnderecoPostalExterior" character varying(20) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "DataObitoCivil" date NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "OrgaoEmisPassaporte" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "PaisEmisPassaporte" character varying(10) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "PortariaNaturalizacao" character varying(60) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "Naturalizacao" character varying(60) NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoCertidaoCivil" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "TipoEstatistica" integer NULL;
                ALTER TABLE "PreAdmissoes" ADD COLUMN IF NOT EXISTS "ValidadeIdentEstrangeiro" date NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Não revertemos campos opcionais de PreAdmissao para evitar perda de dados
        }
    }
}
