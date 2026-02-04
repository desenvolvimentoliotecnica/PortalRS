namespace RhPortal.Api.Application.JobPositions.Handlers;

public interface IDeleteJobPositionHandler
{
    Task<bool> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class DeleteJobPositionHandler : IDeleteJobPositionHandler
{
    private readonly Application.JobPositions.IJobPositionService _service;
    public DeleteJobPositionHandler(Application.JobPositions.IJobPositionService service) => _service = service;

    public Task<bool> HandleAsync(Guid id, CancellationToken ct)
        => _service.DeleteAsync(id, ct);
}
