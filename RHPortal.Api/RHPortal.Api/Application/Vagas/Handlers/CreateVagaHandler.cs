using RhPortal.Api.Contracts.Vagas;

namespace RhPortal.Api.Application.Vagas.Handlers;

public interface ICreateVagaHandler
{
    Task<VagaResponse> HandleAsync(VagaCreateRequest request, CancellationToken ct);
}

public sealed class CreateVagaHandler : ICreateVagaHandler
{
    private readonly IVagaService _service;
    public CreateVagaHandler(IVagaService service) => _service = service;

    public Task<VagaResponse> HandleAsync(VagaCreateRequest request, CancellationToken ct)
        => _service.CreateAsync(request, ct);
}
