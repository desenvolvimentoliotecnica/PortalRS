using Microsoft.EntityFrameworkCore;
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
    private readonly AppDbContext _db;

    public ListVagasPendenciasRhHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<VagaListItemResponse>> HandleAsync(CancellationToken ct)
    {
        try
        {
            // Passo 1a: IDs de vagas de solicitações Aprovadas (rascunho criado, aguarda triagem)
            var vagaIdAprovadas = await _db.SolicitacoesVaga
                .AsNoTracking()
                .Where(s => (short)s.Status == 2 && s.VagaId != null)
                .Select(s => s.VagaId!.Value)
                .Distinct()
                .ToListAsync(ct);

            // Passo 1b: IDs de vagas com headcount pendente de decisão RH (AguardandoDecisaoRH = 9)
            var vagaIdHCPendente = await _db.Vagas
                .AsNoTracking()
                .Where(v => v.HeadcountPendente > 0)
                .Select(v => v.Id)
                .ToListAsync(ct);

            var vagaIdSet = vagaIdAprovadas.Union(vagaIdHCPendente).ToHashSet();

            Console.Error.WriteLine($"[pendencias-rh] vagaIdList={vagaIdSet.Count} (aprovadas={vagaIdAprovadas.Count}, hcPendente={vagaIdHCPendente.Count})");

            if (vagaIdSet.Count == 0)
                return Array.Empty<VagaListItemResponse>();

            // Passo 2: Vagas em rascunho OU com headcount pendente
            var vagas = await _db.Vagas
                .AsNoTracking()
                .Where(v => vagaIdSet.Contains(v.Id))
                .OrderByDescending(v => v.CreatedAtUtc)
                .ToListAsync(ct);

            Console.Error.WriteLine($"[pendencias-rh] vagas={vagas.Count}");

            // Passo 3: Para rascunho, exige que exista solic aprovada; para hcPendente, sempre inclui
            var vagaIdAprovadasSet = vagaIdAprovadas.ToHashSet();
            var vagaIdHCPendenteSet = vagaIdHCPendente.ToHashSet();

            var result = vagas
                .Where(v => (vagaIdAprovadasSet.Contains(v.Id) && (short)v.Status == 1)
                         || vagaIdHCPendenteSet.Contains(v.Id))
                .Select(v => new VagaListItemResponse(
                    v.Id,
                    v.Codigo,
                    v.Titulo,
                    v.Status,
                    v.AreaId,
                    null,
                    null,
                    v.DepartmentId,
                    null,
                    null,
                    v.Modalidade,
                    v.Senioridade,
                    v.QuantidadeVagas,
                    v.MatchMinimoPercentual,
                    v.Confidencial,
                    v.Urgente,
                    v.AceitaPcd,
                    v.DataInicio,
                    v.DataEncerramento,
                    v.DataAbertura,
                    v.SlaDiasMetaFechamento,
                    v.Cidade,
                    v.Uf,
                    0,
                    0,
                    v.CreatedAtUtc,
                    v.UpdatedAtUtc,
                    v.HeadcountAutorizado,
                    0,
                    v.IsEstrutural,
                    v.HeadcountProvisorio,
                    v.HeadcountProvisorioExpiresAtUtc,
                    false,
                    null,
                    v.AlertaVagaSemFillSnoozeAteUtc,
                    v.HeadcountPendente,
                    false
                ))
                .ToList();

            Console.Error.WriteLine($"[pendencias-rh] RESULTADO FINAL={result.Count}");
            return result;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[pendencias-rh] EXCEPTION: {ex}");
            return Array.Empty<VagaListItemResponse>();
        }
    }
}
