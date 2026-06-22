namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>
/// Valida os campos mínimos exigidos para submeter uma pré-admissão pelo RH.
/// A integração TOTVS completa é validada separadamente em <see cref="PreAdmissaoTotvsValidator"/>.
/// </summary>
public static class PreAdmissaoAdmissionValidator
{
    public static List<TotvsValidationIssue> Validate(Domain.Entities.PreAdmissao p)
    {
        var e = new List<TotvsValidationIssue>();

        Req(e, p.Nome, "Nome", "Nome Completo", "Admissão");
        Req(e, p.Rg, "Rg", "RG", "Admissão");
        Req(e, p.Cpf, "Cpf", "CPF", "Admissão");
        ReqDate(e, p.DataNascimento, "DataNascimento", "Data de Nascimento", "Admissão");
        Req(e, p.Cidade, "Cidade", "Cidade", "Admissão");
        Req(e, p.Uf, "Uf", "UF", "Admissão");
        Req(e, p.NomeMae, "NomeMae", "Nome da Mãe", "Admissão");
        Req(e, p.NomePai, "NomePai", "Nome do Pai", "Admissão");
        Req(e, p.PisPasep, "PisPasep", "PIS/PASEP", "Admissão");

        return e;
    }

    private static void Req(
        List<TotvsValidationIssue> e,
        string? value,
        string campo,
        string label,
        string secao)
    {
        if (string.IsNullOrWhiteSpace(value))
            e.Add(new TotvsValidationIssue(campo, label, secao, "Obrigatório", $"Informe {label.ToLowerInvariant()}."));
    }

    private static void ReqDate(
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
