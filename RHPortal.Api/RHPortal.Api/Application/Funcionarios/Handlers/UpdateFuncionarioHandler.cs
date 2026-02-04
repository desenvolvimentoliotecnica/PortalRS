using RhPortal.Api.Contracts.Funcionarios;

namespace RhPortal.Api.Application.Funcionarios.Handlers;

public interface IUpdateFuncionarioHandler
{
    Task<FuncionarioResponse?> HandleAsync(Guid id, FuncionarioUpdateRequest request, CancellationToken ct);
}

public sealed class UpdateFuncionarioHandler : IUpdateFuncionarioHandler
{
    private readonly IFuncionarioService _service;
    public UpdateFuncionarioHandler(IFuncionarioService service) => _service = service;

    public Task<FuncionarioResponse?> HandleAsync(Guid id, FuncionarioUpdateRequest request, CancellationToken ct)
        => _service.UpdateAsync(id, request, ct);
}
