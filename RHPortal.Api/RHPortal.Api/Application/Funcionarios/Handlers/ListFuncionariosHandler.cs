using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Funcionarios;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Funcionarios.Handlers;

public interface IListFuncionariosHandler
{
    Task<PagedResult<FuncionarioGridRowResponse>> HandleAsync(FuncionarioListQuery query, CancellationToken ct);
}

public sealed class ListFuncionariosHandler : IListFuncionariosHandler
{
    private readonly IFuncionarioService _service;
    private readonly ITenantContext _tenantContext;

    public ListFuncionariosHandler(IFuncionarioService service, ITenantContext tenantContext)
    {
        _service = service;
        _tenantContext = tenantContext;
    }

    public async Task<PagedResult<FuncionarioGridRowResponse>> HandleAsync(FuncionarioListQuery query, CancellationToken ct)
    {
        return await _service.ListGridAsync(query ?? new FuncionarioListQuery(null, null, null, null), ct);
    }
}
