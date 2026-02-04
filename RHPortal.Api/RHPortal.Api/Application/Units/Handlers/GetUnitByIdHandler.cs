using RhPortal.Api.Contracts.Units;

namespace RhPortal.Api.Application.Units.Handlers;

public interface IGetUnitByIdHandler
{
    Task<UnitResponse?> HandleAsync(Guid id, CancellationToken ct);
}

public sealed class GetUnitByIdHandler : IGetUnitByIdHandler
{
    private readonly Application.Units.IUnitService _service;
    public GetUnitByIdHandler(Application.Units.IUnitService service) => _service = service;

    public Task<UnitResponse?> HandleAsync(Guid id, CancellationToken ct)
        => _service.GetByIdAsync(id, ct);
}
