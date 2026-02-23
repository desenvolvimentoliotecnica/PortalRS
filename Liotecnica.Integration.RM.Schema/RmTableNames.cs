namespace Liotecnica.Integration.RM.Schema;

/// <summary>
/// Nomes das tabelas do banco CORPORERM (SQL Server) usadas no processo de integração com o Portal RH.
/// Centraliza onde estão Área, Departamento, Cargo e Vaga para facilitar manutenção e rastreio.
/// </summary>
public static class RmTableNames
{
    /// <summary>Tabela de áreas (hierarquia organizacional; pode ter parent/filhas).</summary>
    public const string Area = "AREA";

    /// <summary>Tabela de departamentos.</summary>
    public const string Departamento = "DEPARTAMENTO";

    /// <summary>Tabela de funções (PFUNCAO no RM).</summary>
    public const string Funcao = "PFUNCAO";

    /// <summary>Tabela de cargos (PCARGO no RM).</summary>
    public const string Cargo = "PCARGO";

    /// <summary>Tabela de vagas (aberturas de posição). Padrão: VVAGA. Alternativas no RM: VRSVAGAS (módulo Recrutamento e Seleção), SVAGAS (estágio/convenio).</summary>
    public const string Vaga = "VAGA";

    /// <summary>Tabela de unidades (LUNIDADE no RM; pode estar vazia em alguns ambientes).</summary>
    public const string Unidade = "LUNIDADE";

    /// <summary>Tabela de filiais/estabelecimentos (cadastro de endereços da empresa). Use esta para "Unit" = estabelecimentos no Portal.</summary>
    public const string Filial = "GFILIAL";

    /// <summary>Tabela de funcionários.</summary>
    public const string Funcionario = "EFUNCIONARIO";

    /// <summary>Tabela de pessoas (mestre).</summary>
    public const string Pessoa = "PPESSOA";

    /// <summary>Retorna todas as tabelas envolvidas no processo de integração.</summary>
    public static IReadOnlyList<string> All => new[] { Area, Departamento, Funcao, Cargo, Vaga, Unidade, Funcionario, Pessoa };
}
