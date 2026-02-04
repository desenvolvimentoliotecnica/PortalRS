using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Managers;

public sealed record ManagerListQuery(
    string? Search,
    ManagerStatus? Status,
    Guid? UnitId,
    Guid? AreaId,
    Guid? JobPositionId,
    int Page = 1,
    int PageSize = 20,
    string Sort = "manager",
    string Dir = "asc"
);
