namespace RhPortal.Api.Application.Vagas.Handlers;

public interface IDeleteVagaHandler
{
    Task<bool> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class DeleteVagaHandler : IDeleteVagaHandler
{
    private readonly IVagaService _service;
    public DeleteVagaHandler(IVagaService service) => _service = service;

    public Task<bool> HandleAsync(Guid id, CancellationToken ct)
        => _service.DeleteAsync(id, ct);
}
