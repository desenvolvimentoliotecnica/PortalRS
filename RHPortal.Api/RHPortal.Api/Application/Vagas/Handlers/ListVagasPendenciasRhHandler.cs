using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Contracts.Vagas;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Vagas.Handlers;

public interface IListVagasPendenciasRhHandler
{
    Task<IReadOnlyList<VagaListItemResponse>> HandleAsync(CancellationToken ct);
}

public sealed class ListVagasPendenciasRhHandler : IListVagasPendenciasRhHandler
{
    private readonly IVagaService _vagaService;
    private readonly AppDbContext _db;

    public ListVagasPendenciasRhHandler(IVagaService vagaService, AppDbContext db)
    {
        _vagaService = vagaService;
        _db = db;
    }

    public async Task<IReadOnlyList<VagaListItemResponse>> HandleAsync(CancellationToken ct)
    {
        // Vagas do RH: (1) já foram aprovadas pelos superiores e (2) ainda estão em rascunho
        // para o RH preencher detalhes do portal.
        var vagasRascunho = await _vagaService.ListAsync(
            new VagaListQuery(Q: null, Status: VagaStatus.Rascunho, AreaId: null, DepartmentId: null, RecrutadorUserId: null),
            ct);

        var aprovadasIds = await _db.SolicitacoesVaga
            .AsNoTracking()
            .Where(s => s.Status == SolicitacaoVagaStatus.Aprovada && s.VagaId != null)
            .Select(s => s.VagaId!.Value)
            .Distinct()
            .ToListAsync(ct);

        if (aprovadasIds.Count == 0)
            return Array.Empty<VagaListItemResponse>();

        var set = aprovadasIds.ToHashSet();
        return vagasRascunho
            .Where(v => set.Contains(v.Id))
            .ToList();
    }
}

