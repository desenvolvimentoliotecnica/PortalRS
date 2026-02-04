using RhPortal.Api.Contracts.Matching;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Serviço de cálculo de matching candidato x vaga (texto do perfil vs requisitos).
/// </summary>
public interface IMatchingService
{
    /// <summary>
    /// Calcula o score de matching para o candidato na vaga e persiste em LastMatch* no candidato.
    /// </summary>
    Task CalculateAndStoreAsync(Guid candidatoId, Guid vagaId, CancellationToken ct = default);

    /// <summary>
    /// Retorna candidatos do tenant com score de matching para a vaga, ordenados por score desc.
    /// </summary>
    Task<IReadOnlyList<MatchingCandidateItemResponse>> GetCandidatesWithScoresAsync(
        Guid vagaId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default);
}
