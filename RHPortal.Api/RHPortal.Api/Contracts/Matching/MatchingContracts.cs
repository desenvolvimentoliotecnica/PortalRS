namespace RhPortal.Api.Contracts.Matching;

/// <summary>
/// Item da lista de candidatos com score de matching para uma vaga.
/// </summary>
public sealed record MatchingCandidateItemResponse(
    Guid CandidatoId,
    string Nome,
    string Email,
    int Score,
    bool Pass,
    DateTimeOffset? LastMatchAtUtc
);
