using RhPortal.Api.Contracts.Vagas;

namespace RhPortal.Api.Application.Vagas.Handlers;

public interface IGetVagaByIdHandler
{
    Task<VagaResponse?> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class GetVagaByIdHandler : IGetVagaByIdHandler
{
    private readonly IVagaService _service;
    public GetVagaByIdHandler(IVagaService service) => _service = service;

    public Task<VagaResponse?> HandleAsync(Guid id, CancellationToken ct)
        => _service.GetByIdAsync(id, ct);
}
