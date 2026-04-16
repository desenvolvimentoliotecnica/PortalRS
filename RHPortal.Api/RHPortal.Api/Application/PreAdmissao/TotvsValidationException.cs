namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>
/// Lançada quando uma pré-admissão não cumpre as regras obrigatórias/condicionais
/// do TOTVS HCM (fp1440 + fp1500) ao tentar aprovar.
/// </summary>
public sealed class TotvsValidationException : Exception
{
    public IReadOnlyList<TotvsValidationIssue> Issues { get; }

    public TotvsValidationException(IReadOnlyList<TotvsValidationIssue> issues)
        : base($"{issues.Count} campo(s) obrigatório(s) não preenchido(s) para integração TOTVS.")
    {
        Issues = issues;
    }
}

/// <summary>Descreve um campo com problema de preenchimento.</summary>
public sealed record TotvsValidationIssue(
    /// <summary>Nome da propriedade na entidade (para navegação no form).</summary>
    string Campo,
    /// <summary>Label legível para exibição ao RH.</summary>
    string Label,
    /// <summary>Seção do mapeamento TOTVS (ex: "FP1440 — Cadastral").</summary>
    string Secao,
    /// <summary>"Obrigatório" | "Condicional" | "Conjunto"</summary>
    string TipoRegra,
    /// <summary>Mensagem descritiva para o RH.</summary>
    string Mensagem
);
