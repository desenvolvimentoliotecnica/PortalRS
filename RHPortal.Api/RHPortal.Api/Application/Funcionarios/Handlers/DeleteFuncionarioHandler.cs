namespace RhPortal.Api.Application.Funcionarios.Handlers;

public interface IDeleteFuncionarioHandler
{
    Task<bool> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class DeleteFuncionarioHandler : IDeleteFuncionarioHandler
{
    private readonly IFuncionarioService _service;
    public DeleteFuncionarioHandler(IFuncionarioService service) => _service = service;

    public Task<bool> HandleAsync(Guid id, CancellationToken ct)
        => _service.DeleteAsync(id, ct);
}
