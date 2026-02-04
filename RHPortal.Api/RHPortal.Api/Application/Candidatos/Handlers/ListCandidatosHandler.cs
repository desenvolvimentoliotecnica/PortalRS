using RhPortal.Api.Contracts.Candidates;

namespace RhPortal.Api.Application.Candidatos.Handlers;

public interface IListCandidatosHandler
{
    Task<CandidatePagedResponse> HandleAsync(CandidateListQuery query, CancellationToken ct);
}

public sealed class ListCandidatosHandler : IListCandidatosHandler
{
    private readonly ICandidatoService _service;

    public ListCandidatosHandler(ICandidatoService service) => _service = service;

    public Task<CandidatePagedResponse> HandleAsync(CandidateListQuery query, CancellationToken ct)
        => _service.ListAsync(query, ct);
}
