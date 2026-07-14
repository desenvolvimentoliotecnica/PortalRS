using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Application.Talentos;

namespace RhPortal.Api.Application.Candidatos;

/// <summary>Monta a resposta do parse Novo Candidato a partir do resultado da IA (sem heurística).</summary>
public static class CvParseFieldMerger
{
    public const string FonteAi = "ai";
    public const string FonteError = "error";

    public static CandidatoCurriculoParseResponse FromAi(
        string? cvText,
        CvNovoCandidatoAiData? ai,
        string? aiRawContent,
        bool aiTentou,
        string? aiErro)
    {
        if (ai is null)
        {
            return new CandidatoCurriculoParseResponse(
                string.IsNullOrWhiteSpace(cvText) ? null : cvText.Trim(),
                null, null, null, null, null, null, null, null,
                FonteError,
                aiRawContent,
                aiTentou,
                aiErro ?? "Não foi possível preencher o cadastro com IA.",
                null,
                null,
                Sucesso: false);
        }

        var email = CvHeuristicExtractor.TrimEmailAtKnownTld(ai.Email);
        var uf = ai.Uf?.Trim();
        if (uf is { Length: > 2 })
            uf = uf[..2].ToUpperInvariant();
        else if (uf is { Length: 2 })
            uf = uf.ToUpperInvariant();

        return new CandidatoCurriculoParseResponse(
            string.IsNullOrWhiteSpace(cvText) ? null : cvText.Trim(),
            NullIfBlank(ai.Nome),
            email,
            NullIfBlank(ai.Fone),
            NullIfBlank(ai.Celular) ?? NullIfBlank(ai.Fone),
            NullIfBlank(ai.Cidade),
            uf,
            NullIfBlank(ai.LinkedinUrl),
            ai.PretensaoSalarial,
            FonteAi,
            aiRawContent,
            aiTentou,
            null,
            NullIfBlank(ai.Observacoes),
            ai.TrabalhandoAtualmente,
            Sucesso: true);
    }

    private static string? NullIfBlank(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
