using RhPortal.Api.Contracts.Matching;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Cliente HTTP para o serviço RHPortal.Ai (matching unificado + embeddings).
/// </summary>
public interface IRHPortalAiMatchClient
{
    /// <summary>
    /// Chama POST /matching/run no RHPortal.Ai — matching unificado (vetorial + LLM 80/20).
    /// Retorna ranking de candidatos + talentos com scores detalhados.
    /// Em caso de falha, retorna null para permitir fallback.
    /// </summary>
    Task<IReadOnlyList<MatchingCandidateItemResponse>?> RunUnifiedMatchingAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 20,
        CancellationToken ct = default);

    /// <summary>
    /// [LEGADO] Chama POST /match no RHPortal.Ai e retorna lista de candidatos com score 0-100 (por critérios).
    /// </summary>
    Task<IReadOnlyList<MatchingCandidateItemResponse>?> GetMatchingByFiltersAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default);

    /// <summary>
    /// Chama POST /match-one no RHPortal.Ai para um único (candidato, vaga). [LEGADO]
    /// </summary>
    Task<(int Score, string? Nome, string? Email)?> GetScoreForOneAsync(
        Guid vagaId,
        Guid candidatoId,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Chama POST /matching/evaluate-one no RHPortal.Ai — avalia uma pessoa (candidato ou talento) contra a vaga (LLM 80/20).
    /// </summary>
    Task<(int Score, string? Nome, string? Email)?> EvaluateOneUnifiedAsync(
        Guid vagaId,
        Guid personId,
        string source,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Gera e salva embedding de uma vaga.
    /// </summary>
    Task<bool> GenerateVagaEmbeddingAsync(
        Guid vagaId,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Gera e salva embedding de um candidato.
    /// </summary>
    Task<bool> GenerateCandidatoEmbeddingAsync(
        Guid candidatoId,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Gera e salva embedding de um talento.
    /// </summary>
    Task<bool> GenerateTalentoEmbeddingAsync(
        Guid talentoId,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Gera embeddings em lote para talentos do tenant que ainda não têm (POST /embeddings/talentos/batch).
    /// </summary>
    Task<(int Generated, int TotalProcessed)> GenerateTalentosEmbeddingsBatchAsync(
        string tenantId,
        int limit = 50,
        CancellationToken ct = default);

    /// <summary>
    /// [LEGADO] Chama POST /match-hybrid para matching híbrido.
    /// </summary>
    Task<IReadOnlyList<MatchingCandidateItemResponse>?> GetMatchingHybridAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default);
}
