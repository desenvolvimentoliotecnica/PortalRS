using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Units;

namespace RhPortal.Api.Application.Units.Handlers;

public interface IListUnitsHandler
{
    Task<PagedResult<UnitGridRowResponse>> HandleAsync(UnitListQuery query, CancellationToken ct);
}

public sealed class ListUnitsHandler : IListUnitsHandler
{
    private readonly Application.Units.IUnitService _service;

    public ListUnitsHandler(Application.Units.IUnitService service) => _service = service;

    public Task<PagedResult<UnitGridRowResponse>> HandleAsync(UnitListQuery query, CancellationToken ct)
        => _service.ListGridAsync(query, ct);
}
