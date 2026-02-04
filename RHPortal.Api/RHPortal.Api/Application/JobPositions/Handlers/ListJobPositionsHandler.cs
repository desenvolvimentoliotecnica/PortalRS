using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.JobPositions;

namespace RhPortal.Api.Application.JobPositions.Handlers;

public interface IListJobPositionsHandler
{
    Task<PagedResult<JobPositionGridRowResponse>> HandleAsync(JobPositionListQuery query, CancellationToken ct);
}

public sealed class ListJobPositionsHandler : IListJobPositionsHandler
{
    private readonly Application.JobPositions.IJobPositionService _service;
    public ListJobPositionsHandler(Application.JobPositions.IJobPositionService service) => _service = service;

    public Task<PagedResult<JobPositionGridRowResponse>> HandleAsync(JobPositionListQuery query, CancellationToken ct)
        => _service.ListGridAsync(query, ct);
}
