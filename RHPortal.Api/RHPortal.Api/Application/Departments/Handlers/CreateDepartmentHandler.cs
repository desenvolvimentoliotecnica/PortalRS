using RhPortal.Api.Contracts.Departments;

namespace RhPortal.Api.Application.Departments.Handlers;

public interface ICreateDepartmentHandler
{
    Task<DepartmentResponse> HandleAsync(DepartmentCreateRequest request, CancellationToken ct);
}

public sealed class CreateDepartmentHandler : ICreateDepartmentHandler
{
    private readonly IDepartmentService _service;
    public CreateDepartmentHandler(IDepartmentService service) => _service = service;

    public Task<DepartmentResponse> HandleAsync(DepartmentCreateRequest request, CancellationToken ct)
        => _service.CreateAsync(request, ct);
}
