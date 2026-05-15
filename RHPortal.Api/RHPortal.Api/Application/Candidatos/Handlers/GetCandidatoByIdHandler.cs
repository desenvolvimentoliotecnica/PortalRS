using RhPortal.Api.Contracts.Candidates;

namespace RhPortal.Api.Application.Candidatos.Handlers;

public interface IGetCandidatoByIdHandler
{
    Task<CandidateResponse?> HandleAsync(Guid id, Guid? documentosFiltrarPorVagaId, CancellationToken ct);
}

public sealed class GetCandidatoByIdHandler : IGetCandidatoByIdHandler
{
    private readonly ICandidatoService _service;

    public GetCandidatoByIdHandler(ICandidatoService service) => _service = service;

    public Task<CandidateResponse?> HandleAsync(Guid id, Guid? documentosFiltrarPorVagaId, CancellationToken ct)
        => _service.GetByIdAsync(id, ct, documentosFiltrarPorVagaId);
}
