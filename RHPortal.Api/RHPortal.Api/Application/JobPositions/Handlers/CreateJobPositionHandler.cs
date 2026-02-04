using RhPortal.Api.Contracts.JobPositions;

namespace RhPortal.Api.Application.JobPositions.Handlers;

public interface ICreateJobPositionHandler
{
    Task<JobPositionResponse> HandleAsync(JobPositionCreateRequest request, CancellationToken ct);
}

public sealed class CreateJobPositionHandler : ICreateJobPositionHandler
{
    private readonly Application.JobPositions.IJobPositionService _service;
    public CreateJobPositionHandler(Application.JobPositions.IJobPositionService service) => _service = service;

    public Task<JobPositionResponse> HandleAsync(JobPositionCreateRequest request, CancellationToken ct)
        => _service.CreateAsync(request, ct);
}
