using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Units;

public sealed record UnitListQuery(
    string? Search,
    UnitStatus? Status,
    int Page = 1,
    int PageSize = 20,
    string Sort = "unit",
    string Dir = "asc"
);
