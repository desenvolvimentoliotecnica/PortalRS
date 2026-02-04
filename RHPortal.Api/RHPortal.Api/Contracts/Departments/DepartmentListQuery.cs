using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Departments;

public sealed record DepartmentListQuery(
    string? Search,
    DepartmentStatus? Status,
    Guid? AreaId,
    int Page = 1,
    int PageSize = 20,
    string Sort = "name",
    string Dir = "asc"
);
