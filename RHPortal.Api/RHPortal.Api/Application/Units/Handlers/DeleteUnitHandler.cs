namespace RhPortal.Api.Application.Units.Handlers;

public interface IDeleteUnitHandler
{
    Task<bool> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class DeleteUnitHandler : IDeleteUnitHandler
{
    private readonly Application.Units.IUnitService _service;
    public DeleteUnitHandler(Application.Units.IUnitService service) => _service = service;

    public Task<bool> HandleAsync(Guid id, CancellationToken ct)
        => _service.DeleteAsync(id, ct);
}
