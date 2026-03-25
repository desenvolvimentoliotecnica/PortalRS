using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Application.Matching;

public sealed record VagaUnifiedMatchingRankingSnapshot(
    UnifiedMatchingCacheStatus Status,
    string FiltersHash,
    DateTimeOffset? StartedAtUtc,
    DateTimeOffset? ComputedAtUtc,
    IReadOnlyList<MatchingCandidateItemResponse> Items,
    IReadOnlyList<MatchingCandidateItemResponse> StaleItems,
    string? LastError
);

public interface IVagaUnifiedMatchingCacheService
{
    /// <summary>
    /// Retorna o ranking do cache se pronto; caso contrário inicia (ou mantém) o recálculo em background
    /// e retorna Status=Processing/Failed com stale (se existir).
    /// </summary>
    /// O cache sempre pré-armazena até 100 candidatos. O slice por <c>take</c> é feito no controller.
    Task<VagaUnifiedMatchingRankingSnapshot> GetOrStartAsync(Guid vagaId, int take = 100, CancellationToken ct = default);

    /// <summary>
    /// Marca a vaga como pendente e dispara recálculo em background (idempotente).
    /// Usado ao editar filtros de matching.
    /// </summary>
    Task<VagaUnifiedMatchingRankingSnapshot> InvalidateAndStartAsync(Guid vagaId, int take = 100, CancellationToken ct = default);
}

