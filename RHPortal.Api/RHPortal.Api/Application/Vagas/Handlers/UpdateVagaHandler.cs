using RhPortal.Api.Contracts.Vagas;

namespace RhPortal.Api.Application.Vagas.Handlers;

public interface IUpdateVagaHandler
{
    Task<VagaResponse?> HandleAsync(Guid id, VagaUpdateRequest request, CancellationToken ct);
}

public sealed class UpdateVagaHandler : IUpdateVagaHandler
{
    private readonly IVagaService _service;
    public UpdateVagaHandler(IVagaService service) => _service = service;

    public Task<VagaResponse?> HandleAsync(Guid id, VagaUpdateRequest request, CancellationToken ct)
        => _service.UpdateAsync(id, request, ct);
}
