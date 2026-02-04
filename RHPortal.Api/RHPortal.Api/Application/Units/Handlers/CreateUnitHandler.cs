using RhPortal.Api.Contracts.Units;

namespace RhPortal.Api.Application.Units.Handlers;

public interface ICreateUnitHandler
{
    Task<UnitResponse> HandleAsync(UnitCreateRequest request, CancellationToken ct);
}

public sealed class CreateUnitHandler : ICreateUnitHandler
{
    private readonly Application.Units.IUnitService _service;
    public CreateUnitHandler(Application.Units.IUnitService service) => _service = service;

    public Task<UnitResponse> HandleAsync(UnitCreateRequest request, CancellationToken ct)
        => _service.CreateAsync(request, ct);
}
