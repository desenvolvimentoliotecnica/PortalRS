using RhPortal.Api.Contracts.Talentos;

namespace RhPortal.Api.Application.Talentos;

/// <summary>Resultado da extração de CV via IA, com texto bruto para diagnóstico.</summary>
public sealed record CvGptExtractResult(
    TalentoImportPdfSuggestedData? Data,
    string? RawContent,
    string? Error);

/// <summary>Campos do formulário Novo Candidato extraídos pela IA (sem heurística).</summary>
public sealed record CvNovoCandidatoAiData(
    string? Nome,
    string? Email,
    string? Fone,
    string? Celular,
    string? Cidade,
    string? Uf,
    string? LinkedinUrl,
    decimal? PretensaoSalarial,
    bool? TrabalhandoAtualmente,
    string? Observacoes,
    /// <summary>baixo | parcial | adequado | bom | excelente</summary>
    string? Termometro = null,
    string? TermometroMotivo = null);

public sealed record CvNovoCandidatoExtractResult(
    CvNovoCandidatoAiData? Data,
    string? RawContent,
    string? Error);

/// <summary>Extrai dados estruturados do texto de currículo usando IA (AiModel).</summary>
public interface ICvGptExtractor
{
    /// <summary>Envia o texto do currículo ao modelo de IA e retorna dados sugeridos (pessoa + competências + experiências + treinamentos + formação), ou null se falhar.</summary>
    Task<TalentoImportPdfSuggestedData?> ExtractSuggestedDataAsync(string cvText, CancellationToken ct);

    /// <summary>Igual a <see cref="ExtractSuggestedDataAsync"/>, mas inclui o texto bruto da IA e mensagem de erro (se houver).</summary>
    Task<CvGptExtractResult> ExtractWithDiagnosticsAsync(string cvText, CancellationToken ct);

    /// <summary>Extração dedicada ao modal Novo Candidato: campos do formulário + observações (resumo e fit da vaga).</summary>
    Task<CvNovoCandidatoExtractResult> ExtractForNovoCandidatoAsync(
        string cvText,
        string? vagaTitulo,
        string? vagaContexto,
        CancellationToken ct);
}
