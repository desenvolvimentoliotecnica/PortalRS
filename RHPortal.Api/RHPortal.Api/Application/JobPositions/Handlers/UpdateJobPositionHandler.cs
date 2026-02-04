using RhPortal.Api.Contracts.JobPositions;

namespace RhPortal.Api.Application.JobPositions.Handlers;

public interface IUpdateJobPositionHandler
{
    Task<JobPositionResponse?> HandleAsync(Guid id, JobPositionUpdateRequest request, CancellationToken ct);
}

public sealed class UpdateJobPositionHandler : IUpdateJobPositionHandler
{
    private readonly Application.JobPositions.IJobPositionService _service;
    public UpdateJobPositionHandler(Application.JobPositions.IJobPositionService service) => _service = service;

    public Task<JobPositionResponse?> HandleAsync(Guid id, JobPositionUpdateRequest request, CancellationToken ct)
        => _service.UpdateAsync(id, request, ct);
}
