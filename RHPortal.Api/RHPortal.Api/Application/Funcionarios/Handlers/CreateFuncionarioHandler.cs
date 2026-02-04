using RhPortal.Api.Contracts.Funcionarios;

namespace RhPortal.Api.Application.Funcionarios.Handlers;

public interface ICreateFuncionarioHandler
{
    Task<FuncionarioResponse> HandleAsync(FuncionarioCreateRequest request, CancellationToken ct);
}

public sealed class CreateFuncionarioHandler : ICreateFuncionarioHandler
{
    private readonly IFuncionarioService _service;
    public CreateFuncionarioHandler(IFuncionarioService service) => _service = service;

    public Task<FuncionarioResponse> HandleAsync(FuncionarioCreateRequest request, CancellationToken ct)
        => _service.CreateAsync(request, ct);
}
