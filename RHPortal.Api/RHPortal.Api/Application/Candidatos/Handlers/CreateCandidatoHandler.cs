using RhPortal.Api.Contracts.Candidates;

namespace RhPortal.Api.Application.Candidatos.Handlers;

public interface ICreateCandidatoHandler
{
    Task<CandidateResponse> HandleAsync(CandidateCreateRequest request, CancellationToken ct);
}

public sealed class CreateCandidatoHandler : ICreateCandidatoHandler
{
    private readonly ICandidatoService _service;

    public CreateCandidatoHandler(ICandidatoService service) => _service = service;

    public Task<CandidateResponse> HandleAsync(CandidateCreateRequest request, CancellationToken ct)
        => _service.CreateAsync(request, ct);
}
