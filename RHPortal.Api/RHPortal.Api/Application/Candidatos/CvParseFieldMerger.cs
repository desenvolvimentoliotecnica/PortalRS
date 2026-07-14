using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Contracts.Talentos;

namespace RhPortal.Api.Application.Candidatos;

/// <summary>
/// Mescla resultado de IA com heurística determinística para o parse do Novo Candidato.
/// Prioriza IA nos campos presentes; completa vazios com heurística (ex.: pretensão).
/// </summary>
public static class CvParseFieldMerger
{
    public const string FonteAi = "ai";
    public const string FonteHeuristic = "heuristic";

    public static CandidatoCurriculoParseResponse Merge(
        string? cvText,
        TalentoImportPdfSuggestedData? ai,
        CvHeuristicExtractor.Result heuristic)
    {
        var usedAi = ai is not null;
        var aiPhone = NullIfBlank(ai?.Fone);

        var nome = First(NullIfBlank(ai?.Nome), heuristic.Nome);
        var email = First(NullIfBlank(ai?.Email), heuristic.Email);
        var celular = First(aiPhone, heuristic.Celular, heuristic.Fone);
        var fone = First(
            // se IA trouxe o mesmo número do celular, não duplica em fone fixo
            heuristic.Fone is not null
            && aiPhone is not null
            && DigitsEqual(heuristic.Fone, aiPhone)
                ? null
                : heuristic.Fone);
        if (fone is null && heuristic.Fone is not null && aiPhone is null)
            fone = heuristic.Fone;

        var cidade = First(NullIfBlank(ai?.Cidade), heuristic.Cidade);
        var uf = First(NullIfBlank(ai?.Uf), heuristic.Uf);
        var linkedin = First(NullIfBlank(ai?.LinkedinUrl), heuristic.LinkedinUrl);
        var pretensao = heuristic.PretensaoSalarial;

        return new CandidatoCurriculoParseResponse(
            string.IsNullOrWhiteSpace(cvText) ? null : cvText.Trim(),
            nome,
            email,
            fone,
            celular,
            cidade,
            uf?.Length == 2 ? uf.ToUpperInvariant() : uf,
            linkedin,
            pretensao,
            usedAi ? FonteAi : FonteHeuristic);
    }

    private static string? First(params string?[] values)
    {
        foreach (var v in values)
        {
            if (!string.IsNullOrWhiteSpace(v))
                return v.Trim();
        }
        return null;
    }

    private static string? NullIfBlank(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool DigitsEqual(string a, string b)
    {
        static string Digits(string s) => new string(s.Where(char.IsDigit).ToArray());
        return Digits(a) == Digits(b);
    }
}
