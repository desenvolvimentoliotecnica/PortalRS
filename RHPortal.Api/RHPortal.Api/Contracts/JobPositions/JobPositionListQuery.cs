using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.JobPositions;

public sealed record JobPositionListQuery(
    string? Search,
    CargoStatus? Status,
    /// <summary>Centro de custo — absorveu Area em 31.2.</summary>
    Guid? CentroCustoId,
    SeniorityLevel? Seniority,
    int Page = 1,
    int PageSize = 20,
    string Sort = "cargo",
    string Dir = "asc"
);
