namespace Liotecnica.Integration.RM.Schema;

/// <summary>
/// Nomes das colunas do banco CORPORERM por entidade.
/// Ajuste aqui quando o esquema do RM for conhecido (schema, tabela e colunas reais).
/// </summary>
public static class RmColumnNames
{
    /// <summary>Colunas da tabela de Área (RmTableNames.Area).</summary>
    public static class Area
    {
        /// <summary>Chave primária / identificador.</summary>
        public const string Id = "ID";

        /// <summary>Código da área.</summary>
        public const string Codigo = "CODIGO";

        /// <summary>Nome da área.</summary>
        public const string Nome = "NOME";

        /// <summary>Descrição (opcional).</summary>
        public const string Descricao = "DESCRICAO";

        /// <summary>Área pai (ID da área superior; null para raiz).</summary>
        public const string ParentId = "PARENT_ID";

        /// <summary>Indicador de ativo (ex.: 1/0 ou S/N).</summary>
        public const string Ativo = "ATIVO";
    }

    /// <summary>Colunas da tabela de Departamento/Seção (PSECAO no RM). Tem estrutura pai/filho.</summary>
    public static class Departamento
    {
        /// <summary>Código da seção (ex.: "01", "01.01", "01.01.001").</summary>
        public const string Codigo = "CODIGO";

        /// <summary>Descrição/nome da seção.</summary>
        public const string Descricao = "DESCRICAO";

        /// <summary>Código da seção pai (null = raiz; ex.: "01" ou "01.01" para filhas).</summary>
        public const string CodigoPai = "CODIGOPAI";

        public const string CodColigada = "CODCOLIGADA";
        public const string SecaoDesativada = "SECAODESATIVADA";
    }

    /// <summary>Colunas da tabela de Cargo (RmTableNames.Cargo).</summary>
    public static class Cargo
    {
        public const string Id = "ID";
        public const string Codigo = "CODIGO";
        public const string Nome = "NOME";
        public const string AreaId = "AREA_ID";
        public const string Ativo = "ATIVO";
    }

    /// <summary>Colunas da tabela de Vaga (RmTableNames.Vaga).</summary>
    public static class Vaga
    {
        public const string Id = "ID";
        public const string Codigo = "CODIGO";
        public const string Titulo = "TITULO";
        public const string DepartamentoId = "DEPARTAMENTO_ID";
        public const string AreaId = "AREA_ID";
        public const string CargoId = "CARGO_ID";
        public const string Status = "STATUS";
        public const string QuantidadeVagas = "QUANTIDADE_VAGAS";
    }
}
