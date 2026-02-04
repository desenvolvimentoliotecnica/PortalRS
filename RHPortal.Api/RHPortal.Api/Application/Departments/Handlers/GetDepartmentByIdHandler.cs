using RhPortal.Api.Contracts.Departments;

namespace RhPortal.Api.Application.Departments.Handlers;

public interface IGetDepartmentByIdHandler
{
    Task<DepartmentResponse?> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class GetDepartmentByIdHandler : IGetDepartmentByIdHandler
{
    private readonly IDepartmentService _service;
    public GetDepartmentByIdHandler(IDepartmentService service) => _service = service;

    public Task<DepartmentResponse?> HandleAsync(Guid id, CancellationToken ct)
        => _service.GetByIdAsync(id, ct);
}
