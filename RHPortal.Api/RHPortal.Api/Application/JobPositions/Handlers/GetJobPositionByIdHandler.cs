using RhPortal.Api.Contracts.JobPositions;

namespace RhPortal.Api.Application.JobPositions.Handlers;

public interface IGetJobPositionByIdHandler
{
    Task<JobPositionResponse?> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class GetJobPositionByIdHandler : IGetJobPositionByIdHandler
{
    private readonly Application.JobPositions.IJobPositionService _service;
    public GetJobPositionByIdHandler(Application.JobPositions.IJobPositionService service) => _service = service;

    public Task<JobPositionResponse?> HandleAsync(Guid id, CancellationToken ct)
        => _service.GetByIdAsync(id, ct);
}
