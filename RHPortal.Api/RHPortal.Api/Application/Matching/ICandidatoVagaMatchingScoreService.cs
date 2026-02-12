using RhPortal.Api.Contracts.Matching;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Persistência e leitura do score de matching por IA (candidato, vaga).
/// </summary>
public interface ICandidatoVagaMatchingScoreService
{
    /// <summary>
    /// Insere ou atualiza o score de IA para o par (candidato, vaga).
    /// </summary>
    Task SaveAiScoreAsync(Guid candidatoId, Guid vagaId, int score, CancellationToken ct = default);

    /// <summary>
    /// Retorna o ranking da vaga a partir dos scores persistidos (ordenado por Score desc).
    /// </summary>
    Task<IReadOnlyList<MatchingCandidateItemResponse>> GetRankingByVagaFromStoreAsync(
        Guid vagaId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default);

    /// <summary>
    /// Remove todos os scores da vaga e insere os novos (para recálculo em lote após edição dos filtros).
    /// </summary>
    /// <param name="tenantId">Quando informado (ex.: background), usa este tenant; caso contrário usa o do contexto.</param>
    Task ReplaceScoresForVagaAsync(
        Guid vagaId,
        IReadOnlyList<(Guid CandidatoId, int Score)> items,
        string? tenantId = null,
        CancellationToken ct = default);
}
