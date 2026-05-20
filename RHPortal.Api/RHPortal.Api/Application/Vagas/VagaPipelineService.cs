using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Vagas;

public interface IVagaPipelineService
{
    Task<VagaPipelineResponse> ListarAsync(VagaPipelineFiltros filtros, CancellationToken ct);
}

/// <summary>
/// Pipeline operacional de vagas (pós-aprovação RM).
/// Lê <c>Vaga</c> direto e classifica em 6 estágios baseados na situação operacional do recrutamento,
/// não no fluxo de aprovação Portal-only de <see cref="Domain.Entities.SolicitacaoVaga"/>.
/// </summary>
public sealed class VagaPipelineService : IVagaPipelineService
{
    private const int ZumbiThresholdCiclos = 3;
    private const int SlaDefaultDias = 30;

    public const int EstagioRecemSync = 1;
    public const int EstagioEmDivulgacao = 2;
    public const int EstagioRecrutamentoAtivo = 3;
    public const int EstagioEmSelecao = 4;
    public const int EstagioEmProposta = 5;
    public const int EstagioEncerradaOuZumbi = 6;

    private static readonly (int Estagio, string Nome)[] Colunas =
    {
        (EstagioRecemSync,           "Recém-sincronizada"),
        (EstagioEmDivulgacao,        "Em divulgação"),
        (EstagioRecrutamentoAtivo,   "Recrutamento ativo"),
        (EstagioEmSelecao,           "Em seleção"),
        (EstagioEmProposta,          "Em proposta"),
        (EstagioEncerradaOuZumbi,    "Encerrada / Zumbi"),
    };

    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _currentUser;

    public VagaPipelineService(AppDbContext db, ICurrentUserContext currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<VagaPipelineResponse> ListarAsync(VagaPipelineFiltros filtros, CancellationToken ct)
    {
        var statusExcluidos = new[] { VagaStatus.Rascunho, VagaStatus.Cancelada, VagaStatus.Preenchida, VagaStatus.NaoInformado };

        var vagasQuery = _db.Vagas.AsNoTracking()
            .Where(v => !v.IsEstrutural && !statusExcluidos.Contains(v.Status));

        vagasQuery = AplicarEscopoAnalista(vagasQuery);

        if (filtros.Origem.HasValue)
            vagasQuery = vagasQuery.Where(v => v.OrigemTipo == filtros.Origem.Value);

        if (filtros.CentroCustoId.HasValue)
            vagasQuery = vagasQuery.Where(v => v.CentroCustoId == filtros.CentroCustoId.Value);

        if (!string.IsNullOrWhiteSpace(filtros.Q))
        {
            var q = filtros.Q.Trim().ToLower();
            vagasQuery = vagasQuery.Where(v =>
                (v.Titulo != null && v.Titulo.ToLower().Contains(q)) ||
                (v.Codigo != null && v.Codigo.ToLower().Contains(q)) ||
                (v.FuncaoNomeRm != null && v.FuncaoNomeRm.ToLower().Contains(q)));
        }

        var vagasRaw = await vagasQuery
            .Select(v => new VagaRow(
                v.Id,
                v.Codigo,
                v.Titulo,
                v.OrigemTipo,
                v.CentroCustoId,
                v.CentroCusto != null ? v.CentroCusto.Description : null,
                v.FuncaoNomeRm,
                v.Status,
                v.Visibilidade,
                v.CanalLinkedIn,
                v.CanalSiteCarreiras,
                v.CanalIndicacao,
                v.CanalPortaisEmprego,
                v.DataAbertura,
                v.SlaDiasMetaFechamento,
                v.CiclosAusenteRm,
                v.Urgente,
                v.CreatedAtUtc,
                v.UpdatedAtUtc))
            .ToListAsync(ct);

        if (vagasRaw.Count == 0)
            return new VagaPipelineResponse(BuildEmptyColunas(), 0);

        var vagaIds = vagasRaw.Select(v => v.Id).ToList();

        var candidaturasAgg = await _db.Candidaturas.AsNoTracking()
            .Where(c => vagaIds.Contains(c.VagaId))
            .GroupBy(c => c.VagaId)
            .Select(g => new
            {
                VagaId = g.Key,
                Total = g.Count(),
                Ativas = g.Count(c => c.Status == CandidaturaStatus.Ativa),
                EmProposta = g.Count(c => c.Status == CandidaturaStatus.Ativa && c.EtapaMacro == EtapaMacroCandidatura.Proposta),
                EmSelecao = g.Count(c => c.Status == CandidaturaStatus.Ativa &&
                    (c.EtapaMacro == EtapaMacroCandidatura.EmTriagem
                  || c.EtapaMacro == EtapaMacroCandidatura.Entrevista
                  || c.EtapaMacro == EtapaMacroCandidatura.Teste)),
                Aplicadas = g.Count(c => c.Status == CandidaturaStatus.Ativa && c.EtapaMacro == EtapaMacroCandidatura.Aplicada),
            })
            .ToDictionaryAsync(x => x.VagaId, ct);

        var now = DateTimeOffset.UtcNow;
        var itens = new List<(int Estagio, VagaPipelineItem Item)>(vagasRaw.Count);

        foreach (var v in vagasRaw)
        {
            candidaturasAgg.TryGetValue(v.Id, out var agg);
            var totalCandidatos = agg?.Total ?? 0;
            var candidatosAtivos = agg?.Ativas ?? 0;
            var emProposta = agg?.EmProposta ?? 0;
            var emSelecao = agg?.EmSelecao ?? 0;
            var aplicadas = agg?.Aplicadas ?? 0;

            var isZumbi = v.CiclosAusenteRm >= ZumbiThresholdCiclos;

            var estagio = ClassificarEstagio(v, isZumbi, emProposta, emSelecao, aplicadas);

            if (isZumbi && !filtros.IncluirZumbis)
                continue;

            var dataReferencia = v.DataAbertura ?? v.UpdatedAtUtc;
            var diasNoEstagio = Math.Max(0, (int)(now - dataReferencia).TotalDays);

            var slaTotal = v.SlaDiasMetaFechamento ?? SlaDefaultDias;
            var semaforo = diasNoEstagio <= slaTotal / 2
                ? "verde"
                : (diasNoEstagio <= slaTotal ? "amarelo" : "vermelho");

            itens.Add((estagio, new VagaPipelineItem(
                v.Id,
                v.Codigo,
                v.Titulo,
                v.Origem,
                v.CentroCustoNome,
                v.FuncaoNomeRm,
                v.Status,
                v.DataAbertura,
                diasNoEstagio,
                totalCandidatos,
                candidatosAtivos,
                isZumbi,
                v.CiclosAusenteRm,
                semaforo,
                v.Urgente)));
        }

        var colunas = Colunas
            .Select(col =>
            {
                var vagasDaColuna = itens
                    .Where(x => x.Estagio == col.Estagio)
                    .Select(x => x.Item)
                    .OrderByDescending(x => x.Urgente)
                    .ThenBy(x => x.DataAbertura ?? DateTimeOffset.MaxValue)
                    .ToList();
                return new VagaPipelineColuna(col.Estagio, col.Nome, vagasDaColuna.Count, vagasDaColuna);
            })
            .ToList();

        return new VagaPipelineResponse(colunas, itens.Count);
    }

    private static int ClassificarEstagio(VagaRow v, bool isZumbi, int emProposta, int emSelecao, int aplicadas)
    {
        if (v.Status == VagaStatus.Encerrada || isZumbi)
            return EstagioEncerradaOuZumbi;

        if (emProposta > 0)
            return EstagioEmProposta;

        if (emSelecao > 0)
            return EstagioEmSelecao;

        if (aplicadas > 0)
            return EstagioRecrutamentoAtivo;

        var divulgada = (v.Visibilidade == VagaPublicacaoVisibilidade.Externa
                      || v.Visibilidade == VagaPublicacaoVisibilidade.InternaEExterna)
                      && (v.CanalLinkedIn || v.CanalSiteCarreiras || v.CanalIndicacao || v.CanalPortaisEmprego)
                      && v.Status == VagaStatus.Aberta;
        if (divulgada)
            return EstagioEmDivulgacao;

        return EstagioRecemSync;
    }

    private static IReadOnlyList<VagaPipelineColuna> BuildEmptyColunas()
        => Colunas.Select(c => new VagaPipelineColuna(c.Estagio, c.Nome, 0, Array.Empty<VagaPipelineItem>())).ToList();

    private IQueryable<RHPortal.Api.Domain.Entities.Vaga> AplicarEscopoAnalista(IQueryable<RHPortal.Api.Domain.Entities.Vaga> query)
    {
        if (_currentUser.IsAdmin || _currentUser.IsInRole("Owner"))
        {
            return query;
        }

        if (!_currentUser.UserId.HasValue)
        {
            return query.Where(_ => false);
        }

        var userId = _currentUser.UserId.Value;
        return query.Where(v => _db.SolicitacoesVaga
            .AsNoTracking()
            .Any(s => s.VagaId == v.Id && s.AnalistaRhResponsavelUserId == userId));
    }

    private sealed record VagaRow(
        Guid Id,
        string? Codigo,
        string Titulo,
        VagaOrigemTipo Origem,
        Guid? CentroCustoId,
        string? CentroCustoNome,
        string? FuncaoNomeRm,
        VagaStatus Status,
        VagaPublicacaoVisibilidade? Visibilidade,
        bool CanalLinkedIn,
        bool CanalSiteCarreiras,
        bool CanalIndicacao,
        bool CanalPortaisEmprego,
        DateTimeOffset? DataAbertura,
        int? SlaDiasMetaFechamento,
        int CiclosAusenteRm,
        bool Urgente,
        DateTimeOffset CreatedAtUtc,
        DateTimeOffset UpdatedAtUtc);
}
