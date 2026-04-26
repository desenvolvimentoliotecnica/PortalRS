namespace Liotecnica.Integration.RM.Schema;

/// <summary>
/// Opções configuráveis para o esquema do banco RM (tabelas/colunas).
/// Permite sobrescrever os nomes padrão (RmTableNames / RmColumnNames) via appsettings
/// quando o banco real tiver nomenclatura diferente.
/// </summary>
public sealed class RmSchemaOptions
{
    public const string SectionName = "RmSchema";

    /// <summary>Nome da tabela de áreas. Padrão: RmTableNames.Area.</summary>
    public string AreaTable { get; set; } = RmTableNames.Area;

    /// <summary>Nome da tabela de departamentos.</summary>
    public string DepartamentoTable { get; set; } = RmTableNames.Departamento;

    /// <summary>Nome da tabela de funções (ex.: PFUNCAO no RM).</summary>
    public string FuncaoTable { get; set; } = RmTableNames.Funcao;

    /// <summary>Nome da tabela de cargos (ex.: PCARGO no RM).</summary>
    public string CargoTable { get; set; } = RmTableNames.Cargo;

    /// <summary>Nome da tabela de vagas.</summary>
    public string VagaTable { get; set; } = RmTableNames.Vaga;

    /// <summary>Nome da tabela de unidades/estabelecimentos. Padrão: GFILIAL (estabelecimentos da empresa). Alternativa: LUNIDADE.</summary>
    public string UnidadeTable { get; set; } = RmTableNames.Filial;

    /// <summary>Nome da tabela de funcionários.</summary>
    public string FuncionarioTable { get; set; } = RmTableNames.Funcionario;

    /// <summary>Nome da tabela de pessoas.</summary>
    public string PessoaTable { get; set; } = RmTableNames.Pessoa;

    /// <summary>Hierarquia/organograma TOTVS RM. Padrão: VHIERARQUIA.</summary>
    public string HierarquiaTable { get; set; } = RmTableNames.Hierarquia;

    /// <summary>Solicitação de desligamento. Padrão: VREQDESLIGAMENTO.</summary>
    public string DesligamentoTable { get; set; } = RmTableNames.Desligamento;

    /// <summary>Solicitação de aumento de quadro (vaga nova). Padrão: VREQAUMENTOQUADRO.</summary>
    public string AumentoQuadroTable { get; set; } = RmTableNames.AumentoQuadro;

    /// <summary>Solicitação de substituição (gerada quando desligamento/promoção pede). Padrão: VREQSUBSTITUICAO.</summary>
    public string SubstituicaoTable { get; set; } = RmTableNames.Substituicao;

    /// <summary>Solicitação de transferência ou promoção do funcionário. Padrão: VREQTRANSFPROMOCAO.</summary>
    public string TransferenciaPromocaoTable { get; set; } = RmTableNames.TransferenciaPromocao;

    /// <summary>Schema do banco (ex.: "dbo"). Opcional.</summary>
    public string? Schema { get; set; }

    /// <summary>Nome completo da tabela (Schema.TableName).</summary>
    public string FullTableName(string tableName)
    {
        if (string.IsNullOrWhiteSpace(Schema))
            return tableName;
        return $"{Schema.Trim()}.{tableName.Trim()}";
    }
}
