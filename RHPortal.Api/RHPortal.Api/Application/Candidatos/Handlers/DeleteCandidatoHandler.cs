namespace RhPortal.Api.Application.Candidatos.Handlers;

public interface IDeleteCandidatoHandler
{
    Task<bool> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class DeleteCandidatoHandler : IDeleteCandidatoHandler
{
    private readonly ICandidatoService _service;

    public DeleteCandidatoHandler(ICandidatoService service) => _service = service;

    public Task<bool> HandleAsync(Guid id, CancellationToken ct)
        => _service.DeleteAsync(id, ct);
}
