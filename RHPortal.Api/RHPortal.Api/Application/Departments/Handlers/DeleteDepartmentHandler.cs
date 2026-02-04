namespace RhPortal.Api.Application.Departments.Handlers;

public interface IDeleteDepartmentHandler
{
    Task<bool> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class DeleteDepartmentHandler : IDeleteDepartmentHandler
{
    private readonly IDepartmentService _service;
    public DeleteDepartmentHandler(IDepartmentService service) => _service = service;

    public Task<bool> HandleAsync(Guid id, CancellationToken ct)
        => _service.DeleteAsync(id, ct);
}
