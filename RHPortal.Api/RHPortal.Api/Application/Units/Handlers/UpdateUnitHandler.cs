using RhPortal.Api.Contracts.Units;

namespace RhPortal.Api.Application.Units.Handlers;

public interface IUpdateUnitHandler
{
    Task<UnitResponse?> HandleAsync(Guid id, UnitUpdateRequest request, CancellationToken ct);
}

public sealed class UpdateUnitHandler : IUpdateUnitHandler
{
    private readonly Application.Units.IUnitService _service;
    public UpdateUnitHandler(Application.Units.IUnitService service) => _service = service;

    public Task<UnitResponse?> HandleAsync(Guid id, UnitUpdateRequest request, CancellationToken ct)
        => _service.UpdateAsync(id, request, ct);
}
