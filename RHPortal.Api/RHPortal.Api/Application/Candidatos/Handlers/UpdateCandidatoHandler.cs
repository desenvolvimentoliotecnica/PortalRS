using RhPortal.Api.Contracts.Candidates;

namespace RhPortal.Api.Application.Candidatos.Handlers;

public interface IUpdateCandidatoHandler
{
    Task<CandidateResponse?> HandleAsync(Guid id, CandidateUpdateRequest request, CancellationToken ct);
}

public sealed class UpdateCandidatoHandler : IUpdateCandidatoHandler
{
    private readonly ICandidatoService _service;

    public UpdateCandidatoHandler(ICandidatoService service) => _service = service;

    public Task<CandidateResponse?> HandleAsync(Guid id, CandidateUpdateRequest request, CancellationToken ct)
        => _service.UpdateAsync(id, request, ct);
}
