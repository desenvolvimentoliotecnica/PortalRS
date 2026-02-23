using RhPortal.Api.Contracts.Vagas;

namespace RhPortal.Api.Application.Vagas.Handlers;

public interface IUpdateVagaMatchingFiltrosHandler
{
    Task<VagaResponse?> HandleAsync(Guid id, UpdateVagaMatchingFiltrosRequest request, CancellationToken ct);
}

public sealed class UpdateVagaMatchingFiltrosHandler : IUpdateVagaMatchingFiltrosHandler
{
    private readonly IVagaService _service;

    public UpdateVagaMatchingFiltrosHandler(IVagaService service) => _service = service;

    public Task<VagaResponse?> HandleAsync(Guid id, UpdateVagaMatchingFiltrosRequest request, CancellationToken ct)
        => _service.UpdateMatchingFiltrosAsync(id, request?.MatchingFiltrosRaw, ct);
}
