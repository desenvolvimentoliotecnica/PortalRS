using RhPortal.Api.Contracts.Departments;

namespace RhPortal.Api.Application.Departments.Handlers;

public interface IUpdateDepartmentHandler
{
    Task<DepartmentResponse?> HandleAsync(Guid id, DepartmentUpdateRequest request, CancellationToken ct);
}

public sealed class UpdateDepartmentHandler : IUpdateDepartmentHandler
{
    private readonly IDepartmentService _service;
    public UpdateDepartmentHandler(IDepartmentService service) => _service = service;

    public Task<DepartmentResponse?> HandleAsync(Guid id, DepartmentUpdateRequest request, CancellationToken ct)
        => _service.UpdateAsync(id, request, ct);
}
