using RhPortal.Api.Contracts.Vagas;

namespace RhPortal.Api.Application.Vagas.Handlers;

public interface IListVagasHandler
{
    Task<IReadOnlyList<VagaListItemResponse>> HandleAsync(VagaListQuery query, CancellationToken ct);
}

public sealed class ListVagasHandler : IListVagasHandler
{
    private readonly IVagaService _service;
    public ListVagasHandler(IVagaService service) => _service = service;

    public Task<IReadOnlyList<VagaListItemResponse>> HandleAsync(VagaListQuery query, CancellationToken ct)
        => _service.ListAsync(query, ct);
}
