using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Vagas.Handlers;

public interface IListVagasPendenciasRhHandler
{
    Task<IReadOnlyList<VagaListItemResponse>> HandleAsync(CancellationToken ct);
}

public sealed class ListVagasPendenciasRhHandler : IListVagasPendenciasRhHandler
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _currentUser;

    public ListVagasPendenciasRhHandler(AppDbContext db, ICurrentUserContext currentUser)
    {
        _db = db;
        _currentUser = currentUser;
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

            // Passo 1b: IDs de vagas com headcount pendente (aguardando aprovação do aumento pela Diretoria)
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
            var vagasQuery = _db.Vagas
                .AsNoTracking()
                .Include(v => v.Ocupacoes)
                .Where(v => vagaIdSet.Contains(v.Id));

            if (!_currentUser.IsAdmin && !_currentUser.IsOwner)
            {
                var currentUserId = _currentUser.UserId;
                vagasQuery = _currentUser.VagasDataScope switch
                {
                    VagasDataScope.ByArea when _currentUser.CentroCustoId.HasValue =>
                        vagasQuery.Where(v =>
                            v.CentroCustoId == _currentUser.CentroCustoId.Value
                            || (currentUserId.HasValue && _db.SolicitacoesVaga.Any(s =>
                                s.VagaId == v.Id
                                && s.AnalistaRhResponsavelUserId == currentUserId.Value))),

                    VagasDataScope.ByRecrutador when _currentUser.UserId.HasValue =>
                        vagasQuery.Where(v =>
                            v.RecrutadorResponsavelUserId == currentUserId.Value
                            || _db.SolicitacoesVaga.Any(s =>
                                s.VagaId == v.Id
                                && s.AnalistaRhResponsavelUserId == currentUserId.Value)
                            || (v.Status == VagaStatus.Aberta && v.RecrutadorResponsavelUserId == null)),

                    VagasDataScope.ByGestorRecrutador when _currentUser.FuncionarioId.HasValue =>
                        vagasQuery.Where(v =>
                            (v.RecrutadorResponsavelUser != null
                             && v.RecrutadorResponsavelUser.Funcionario != null
                             && v.RecrutadorResponsavelUser.Funcionario.GestorDiretoId == _currentUser.FuncionarioId.Value)
                            || (currentUserId.HasValue && _db.SolicitacoesVaga.Any(s =>
                                s.VagaId == v.Id
                                && s.AnalistaRhResponsavelUserId == currentUserId.Value))),

                    _ => vagasQuery
                };
            }

            var vagas = await vagasQuery
                .OrderByDescending(v => v.CreatedAtUtc)
                .ToListAsync(ct);

            Console.Error.WriteLine($"[pendencias-rh] vagas={vagas.Count}");

            // Passo 3: Para rascunho, exige que exista solic aprovada; para hcPendente, sempre inclui
            var vagaIdAprovadasSet = vagaIdAprovadas.ToHashSet();
            var vagaIdHCPendenteSet = vagaIdHCPendente.ToHashSet();

            // Para vagas com HC pendente, o SLA deve partir da data da solicitação que gerou o aumento,
            // não da data de criação da vaga original.
            var hcSolicDates = await _db.SolicitacoesVaga
                .AsNoTracking()
                .Where(s => s.VagaId != null
                         && vagaIdHCPendenteSet.Contains(s.VagaId!.Value)
                         && (short)s.Status == (short)SolicitacaoStatus.PendenteAprovacaoAumentoHC)
                .GroupBy(s => s.VagaId!.Value)
                .Select(g => new { VagaId = g.Key, CreatedAtUtc = g.Max(s => s.CreatedAtUtc) })
                .ToDictionaryAsync(x => x.VagaId, x => x.CreatedAtUtc, ct);

            var filtered = vagas
                .Where(v => (vagaIdAprovadasSet.Contains(v.Id) && (short)v.Status == 1)
                         || vagaIdHCPendenteSet.Contains(v.Id))
                .ToList();

            IReadOnlyDictionary<Guid, (Guid? UserId, string? Nome)>? analistaPorVagaId = null;
            if (filtered.Count > 0)
            {
                var ids = filtered.Select(v => v.Id).ToList();
                var solicRows = await _db.SolicitacoesVaga.AsNoTracking()
                    .Include(s => s.AnalistaRhResponsavelUser)
                    .Where(s => s.VagaId != null && ids.Contains(s.VagaId.Value))
                    .ToListAsync(ct);

                analistaPorVagaId = solicRows
                    .GroupBy(s => s.VagaId!.Value)
                    .ToDictionary(
                        g => g.Key,
                        g =>
                        {
                            var best = g.OrderByDescending(x => x.AnalistaRhResponsavelUserId.HasValue ? 1 : 0).First();
                            var u = best.AnalistaRhResponsavelUser;
                            var nome = u is null
                                ? null
                                : (!string.IsNullOrWhiteSpace(u.FullName) ? u.FullName : u.UserName);
                            return (best.AnalistaRhResponsavelUserId, nome);
                        });
            }

            var result = new List<VagaListItemResponse>(filtered.Count);
            foreach (var v in filtered)
            {
                var createdAtUtc = vagaIdHCPendenteSet.Contains(v.Id) && hcSolicDates.TryGetValue(v.Id, out var solDate)
                    ? solDate
                    : v.CreatedAtUtc;

                Guid? recUserId = v.RecrutadorResponsavelUserId;
                string? recNome = v.RecrutadorResponsavel;
                if (analistaPorVagaId is not null && analistaPorVagaId.TryGetValue(v.Id, out var an))
                {
                    recUserId ??= an.UserId;
                    if (string.IsNullOrWhiteSpace(recNome) && !string.IsNullOrWhiteSpace(an.Nome))
                        recNome = an.Nome;
                }

                if (recNome is { Length: > 120 })
                    recNome = recNome[..120];

                result.Add(new VagaListItemResponse(
                    v.Id,
                    v.Codigo,
                    v.Titulo,
                    v.Status,
                    v.CentroCustoId,
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
                    createdAtUtc,
                    v.UpdatedAtUtc,
                    v.HeadcountAutorizado,
                    v.Ocupacoes?.Count(o => o.DataSaida == null) ?? 0,
                    v.IsEstrutural,
                    v.HeadcountProvisorio,
                    v.HeadcountProvisorioExpiresAtUtc,
                    false,
                    null,
                    v.AlertaVagaSemFillSnoozeAteUtc,
                    v.HeadcountPendente,
                    false,
                    v.UnidadeLotacaoId,
                    null,
                    null,
                    null,
                    null,
                    v.OrigemTipo,
                    null,
                    v.HierarquiaId,
                    null,
                    v.IdReqRmOrigem,
                    v.CodFuncaoRm,
                    v.FuncaoNomeRm,
                    recUserId,
                    recNome));
            }

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
