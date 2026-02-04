using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Departments;

namespace RhPortal.Api.Application.Departments.Handlers;

public interface IListDepartmentsHandler
{
    Task<PagedResult<DepartmentGridRowResponse>> HandleAsync(DepartmentListQuery query, CancellationToken ct);
}

public sealed class ListDepartmentsHandler : IListDepartmentsHandler
{
    private readonly IDepartmentService _service;
    public ListDepartmentsHandler(IDepartmentService service) => _service = service;

    public Task<PagedResult<DepartmentGridRowResponse>> HandleAsync(DepartmentListQuery query, CancellationToken ct)
        => _service.ListGridAsync(query, ct);
}
