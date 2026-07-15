namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>
/// Valida os campos mínimos exigidos para submeter/aprovar uma pré-admissão pelo RH.
/// A integração TOTVS completa é validada separadamente em <see cref="PreAdmissaoTotvsValidator"/>.
/// </summary>
public static class PreAdmissaoAdmissionValidator
{
    public static List<TotvsValidationIssue> Validate(Domain.Entities.PreAdmissao p)
    {
        var e = new List<TotvsValidationIssue>();

        Obr(e, p.Nome, "Nome", "Nome Completo", "Admissão");
        Obr(e, p.Rg, "Rg", "RG", "Admissão");
        Obr(e, p.Cpf, "Cpf", "CPF", "Admissão");
        ObrDate(e, p.DataNascimento, "DataNascimento", "Data de Nascimento", "Admissão");
        Obr(e, p.Cidade, "Cidade", "Cidade", "Admissão");
        Obr(e, p.Uf, "Uf", "UF", "Admissão");
        Obr(e, p.NomeMae, "NomeMae", "Nome da Mãe", "Admissão");
        Obr(e, p.NomePai, "NomePai", "Nome do Pai", "Admissão");
        Obr(e, p.Email, "Email", "E-mail", "Admissão");
        Obr(e, p.Celular, "Celular", "Celular", "Admissão");

        return e;
    }

    private static void Obr(
        List<TotvsValidationIssue> e,
        string? value,
        string campo,
        string label,
        string secao)
    {
        if (string.IsNullOrWhiteSpace(value))
            e.Add(new TotvsValidationIssue(campo, label, secao, "Obrigatório", $"Informe {label.ToLowerInvariant()}."));
    }

    private static void ObrDate(
        List<TotvsValidationIssue> e,
        DateOnly? value,
        string campo,
        string label,
        string secao)
    {
        if (value is null)
            e.Add(new TotvsValidationIssue(campo, label, secao, "Obrigatório", $"Informe {label.ToLowerInvariant()}."));
    }
}
