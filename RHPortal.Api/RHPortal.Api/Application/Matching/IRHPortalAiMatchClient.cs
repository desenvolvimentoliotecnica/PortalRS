using RhPortal.Api.Contracts.Matching;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Cliente HTTP para o serviço RHPortal.Ai (matching por filtros da vaga).
/// </summary>
public interface IRHPortalAiMatchClient
{
    /// <summary>
    /// Chama POST /match no RHPortal.Ai e retorna lista de candidatos com score 0-100 (por critérios).
    /// Em caso de falha (rede, 5xx), retorna null para permitir fallback.
    /// </summary>
    Task<IReadOnlyList<MatchingCandidateItemResponse>?> GetMatchingByFiltersAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default);

    /// <summary>
    /// Chama POST /match-one no RHPortal.Ai para um único (candidato, vaga). Retorna (Score, Nome, Email) ou null em falha.
    /// </summary>
    Task<(int Score, string? Nome, string? Email)?> GetScoreForOneAsync(
        Guid vagaId,
        Guid candidatoId,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Chama POST /embeddings/vaga/{id} para gerar e salvar embedding de uma vaga.
    /// Retorna true se sucesso.
    /// </summary>
    Task<bool> GenerateVagaEmbeddingAsync(
        Guid vagaId,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Chama POST /embeddings/candidato/{id} para gerar e salvar embedding de um candidato.
    /// Retorna true se sucesso.
    /// </summary>
    Task<bool> GenerateCandidatoEmbeddingAsync(
        Guid candidatoId,
        string tenantId,
        CancellationToken ct = default);

    /// <summary>
    /// Chama POST /match-hybrid para matching híbrido (vetorial + LLM).
    /// Retorna null em falha.
    /// </summary>
    Task<IReadOnlyList<MatchingCandidateItemResponse>?> GetMatchingHybridAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default);
}
