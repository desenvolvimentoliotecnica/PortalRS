using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Vagas;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

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
                vagasQuery = _currentUser.VagasDataScope switch
                {
                    VagasDataScope.ByArea when _currentUser.CentroCustoId.HasValue =>
                        vagasQuery.Where(v => v.CentroCustoId == _currentUser.CentroCustoId.Value),

                    VagasDataScope.ByRecrutador when _currentUser.UserId.HasValue =>
                        vagasQuery.Where(v => v.RecrutadorResponsavelUserId == _currentUser.UserId.Value),

                    VagasDataScope.ByGestorRecrutador when _currentUser.FuncionarioId.HasValue =>
                        vagasQuery.Where(v =>
                            v.RecrutadorResponsavelUser != null
                            && v.RecrutadorResponsavelUser.Funcionario != null
                            && v.RecrutadorResponsavelUser.Funcionario.GestorDiretoId == _currentUser.FuncionarioId.Value),

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

            var result = vagas
                .Where(v => (vagaIdAprovadasSet.Contains(v.Id) && (short)v.Status == 1)
                         || vagaIdHCPendenteSet.Contains(v.Id))
                .Select(v => new VagaListItemResponse(
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
                    vagaIdHCPendenteSet.Contains(v.Id) && hcSolicDates.TryGetValue(v.Id, out var solDate)
                        ? solDate
                        : v.CreatedAtUtc,
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
                    null, // SubstituindoNome — não carregado neste handler
                    v.HierarquiaId,
                    null, // HierarquiaDescricao — não carregada neste handler
                    v.IdReqRmOrigem,
                    v.CodFuncaoRm,
                    v.FuncaoNomeRm
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
