using RhPortal.Api.Contracts.Funcionarios;

namespace RhPortal.Api.Application.Funcionarios.Handlers;

public interface IGetFuncionarioByIdHandler
{
    Task<FuncionarioResponse?> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class GetFuncionarioByIdHandler : IGetFuncionarioByIdHandler
{
    private readonly IFuncionarioService _service;
    public GetFuncionarioByIdHandler(IFuncionarioService service) => _service = service;

    public Task<FuncionarioResponse?> HandleAsync(Guid id, CancellationToken ct)
        => _service.GetByIdAsync(id, ct);
}
