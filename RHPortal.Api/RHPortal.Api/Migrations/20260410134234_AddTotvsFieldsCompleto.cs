using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RHPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTotvsFieldsCompleto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Avos13SalCalc",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Avos13SalCalcAnterior",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Cabelo",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Calcula13",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CargaAutomTurno",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CategoriaTrabalhoESocial",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CnhDataExpedicao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CnhNumero",
                table: "PreAdmissoes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CnhOrgaoEmissor",
                table: "PreAdmissoes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CnhPrimeiraHabilitacao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CnhUf",
                table: "PreAdmissoes",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodClassFuncPontoEletronico",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CodEmpresa",
                table: "PreAdmissoes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodFpas",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodLocalMarcacao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodLocalidade",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodNivel",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodPlanoLotacao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodSindicato",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodTurma",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConsidEmissRAIS",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContribSindicDia",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CtpsSerieESocial",
                table: "PreAdmissoes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Cutis",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DataTerminoContrato",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DddTelContato",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DddTelefone",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescContribSindical",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DiasProvFeriasMesAnterior",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DiasProvFeriasMesAtual",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailAlternativo",
                table: "PreAdmissoes",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmitCartPonto",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FormaPagamento",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FuncDoador",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FuncQualificado",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IndAdmissao",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IndFuncVinculado",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Manequim",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MatriculaESocial",
                table: "PreAdmissoes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MunicipioEnderecoIbge",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MunicipioNascimentoIbge",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NaturezaAtividade",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomeAbreviado",
                table: "PreAdmissoes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NumCartaoPonto",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OcorrenciaCAGED",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Olhos",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OptanteFgts",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrigemFuncionario",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaisLocalidade",
                table: "PreAdmissoes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaisNascimento",
                table: "PreAdmissoes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PontoReferencia",
                table: "PreAdmissoes",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProvAcum13Sal",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProvAcumFerias",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProvAcumFerias13",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProvAcumFgts13Sal",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProvAcumFgtsFerias",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProvAcumInss13Sal",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProvAcumInssFerias",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecebeAdiantamento",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecebeFerias",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecebeInsalub",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecebePericul",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecolheFgts",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecolheInss",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RegimeJornada",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RegimePrevidenciario",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RegimeTrabalhista",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RgUfExpedidor",
                table: "PreAdmissoes",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SalarioSimulado",
                table: "PreAdmissoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Sapato",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Sindicalizado",
                table: "PreAdmissoes",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoAdmissaoESocial",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoAdmissaoFgts",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TipoLogradouroESocial",
                table: "PreAdmissoes",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TipoMaoDeObra",
                table: "PreAdmissoes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoVistoEstrangeiro",
                table: "PreAdmissoes",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Avos13SalCalc",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Avos13SalCalcAnterior",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Cabelo",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Calcula13",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CargaAutomTurno",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CategoriaTrabalhoESocial",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CnhDataExpedicao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CnhNumero",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CnhOrgaoEmissor",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CnhPrimeiraHabilitacao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CnhUf",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodClassFuncPontoEletronico",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodEmpresa",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodFpas",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodLocalMarcacao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodLocalidade",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodNivel",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodPlanoLotacao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodSindicato",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CodTurma",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ConsidEmissRAIS",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ContribSindicDia",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "CtpsSerieESocial",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Cutis",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DataTerminoContrato",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DddTelContato",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DddTelefone",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DescContribSindical",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DiasProvFeriasMesAnterior",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "DiasProvFeriasMesAtual",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "EmailAlternativo",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "EmitCartPonto",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "FormaPagamento",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "FuncDoador",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "FuncQualificado",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "IndAdmissao",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "IndFuncVinculado",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Manequim",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "MatriculaESocial",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "MunicipioEnderecoIbge",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "MunicipioNascimentoIbge",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "NaturezaAtividade",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "NomeAbreviado",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "NumCartaoPonto",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "OcorrenciaCAGED",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Olhos",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "OptanteFgts",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "OrigemFuncionario",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "PaisLocalidade",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "PaisNascimento",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "PontoReferencia",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ProvAcum13Sal",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ProvAcumFerias",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ProvAcumFerias13",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ProvAcumFgts13Sal",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ProvAcumFgtsFerias",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ProvAcumInss13Sal",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "ProvAcumInssFerias",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RecebeAdiantamento",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RecebeFerias",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RecebeInsalub",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RecebePericul",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RecolheFgts",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RecolheInss",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RegimeJornada",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RegimePrevidenciario",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RegimeTrabalhista",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "RgUfExpedidor",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "SalarioSimulado",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Sapato",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "Sindicalizado",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TipoAdmissaoESocial",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TipoAdmissaoFgts",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TipoLogradouroESocial",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TipoMaoDeObra",
                table: "PreAdmissoes");

            migrationBuilder.DropColumn(
                name: "TipoVistoEstrangeiro",
                table: "PreAdmissoes");
        }
    }
}
