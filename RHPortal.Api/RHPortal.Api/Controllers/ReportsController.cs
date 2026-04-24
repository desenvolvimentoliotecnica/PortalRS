using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Reports;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/reports")]
[RequireModule("relatorios")]
public sealed class ReportsController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;
    private readonly ICurrentUserContext _userContext;

    public ReportsController(IStringLocalizer<ControllerMessages> localizer, ICurrentUserContext userContext)
    {
        _localizer = localizer;
        _userContext = userContext;
    }

    private Guid? EffectiveCentroCustoId =>
        _userContext.IsAdmin || _userContext.IsInRole("Owner")
            ? null
            : _userContext.VagasDataScope == VagasDataScope.ByArea && _userContext.CentroCustoId.HasValue
                ? _userContext.CentroCustoId
                : null;

    private Guid? EffectiveRecrutadorUserId =>
        _userContext.IsAdmin || _userContext.IsInRole("Owner")
            ? null
            : _userContext.VagasDataScope == VagasDataScope.ByRecrutador && _userContext.UserId.HasValue
                ? _userContext.UserId
                : null;

    [HttpGet("catalog")]
    public ActionResult<IReadOnlyList<ReportCatalogItemResponse>> GetCatalog()
    {
        var items = new List<ReportCatalogItemResponse>
        {
            new(
                "r1",
                "bar-chart",
                _localizer["ControllerLabels.ReportCatalogEntradaPorOrigemTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogEntradaPorOrigemDescription"].Value,
                "entrada"),
            new(
                "r2",
                "exclamation-triangle",
                _localizer["ControllerLabels.ReportCatalogFalhasProcessamentoTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogFalhasProcessamentoDescription"].Value,
                "entrada"),
            new(
                "r3",
                "people",
                _localizer["ControllerLabels.ReportCatalogPipelineStatusTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogPipelineStatusDescription"].Value,
                "candidatos"),
            new(
                "r4",
                "briefcase",
                _localizer["ControllerLabels.ReportCatalogFunilVagaTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogFunilVagaDescription"].Value,
                "vagas"),
            new(
                "r5",
                "stars",
                _localizer["ControllerLabels.ReportCatalogRankingMatchingTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogRankingMatchingDescription"].Value,
                "matching"),
            new(
                "r6",
                "alarm",
                _localizer["ControllerLabels.ReportCatalogSlaVagaTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogSlaVagaDescription"].Value,
                "vagas"),
            // ── Relatórios de gestão de pessoas ──
            new(
                "r7",
                "trending-up",
                _localizer["ControllerLabels.ReportCatalogMovimentacaoHeadcountTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogMovimentacaoHeadcountDescription"].Value,
                "headcount"),
            new(
                "r8",
                "trending-down",
                _localizer["ControllerLabels.ReportCatalogTurnoverRetencaoTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogTurnoverRetencaoDescription"].Value,
                "turnover"),
            new(
                "r9",
                "timer",
                _localizer["ControllerLabels.ReportCatalogTthContratacaoTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogTthContratacaoDescription"].Value,
                "tth"),
            new(
                "r10",
                "chart-bar",
                _localizer["ControllerLabels.ReportCatalogHeadcountPlanRealTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogHeadcountPlanRealDescription"].Value,
                "headcount"),
            new(
                "r11",
                "users-round",
                _localizer["ControllerLabels.ReportCatalogPiramideEtariaTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogPiramideEtariaDescription"].Value,
                "diversidade"),
            new(
                "r12",
                "arrow-up-right",
                _localizer["ControllerLabels.ReportCatalogPromocoesTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogPromocoesDescription"].Value,
                "promocoes"),
            new(
                "r13",
                "palm-tree",
                _localizer["ControllerLabels.ReportCatalogFeriasTitle"].Value,
                _localizer["ControllerLabels.ReportCatalogFeriasDescription"].Value,
                "ferias")
        };

        return Ok(items);
    }

    [HttpGet("vagas")]
    public async Task<ActionResult<IReadOnlyList<ReportVagaLookupResponse>>> GetVagas(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var q = db.Vagas.AsNoTracking();
        if (EffectiveCentroCustoId is { } areaId)
            q = q.Where(v => v.CentroCustoId == areaId);
        if (EffectiveRecrutadorUserId is { } recrutadorUserId)
            q = q.Where(v => v.RecrutadorResponsavelUserId == recrutadorUserId);
        var items = await q
            .OrderBy(v => v.Titulo)
            .Select(v => new ReportVagaLookupResponse(v.Id, v.Codigo, v.Titulo))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("entrada-origem")]
    public async Task<ActionResult<ReportDataResponse>> GetEntradaPorOrigem(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildInboxQuery(db, period, vagaId, origem, status, q, EffectiveCentroCustoId, EffectiveRecrutadorUserId);

        var list = await query
            .OrderByDescending(c => c.RecebidoEm)
            .Take(30)
            .Select(c => new
            {
                c.RecebidoEm,
                c.Origem,
                c.Remetente,
                c.Assunto,
                VagaTitulo = c.Vaga != null ? c.Vaga.Titulo : null,
                VagaCodigo = c.Vaga != null ? c.Vaga.Codigo : null,
                c.Status
            })
            .ToListAsync(ct);

        var countByFonte = list
            .GroupBy(c => c.Origem)
            .ToDictionary(g => g.Key, g => g.Count());

        var labels = new[]
        {
            _localizer["ControllerLabels.Email"].Value,
            _localizer["ControllerLabels.Pasta"].Value,
            _localizer["ControllerLabels.Upload"].Value
        };
        var values = new List<int>
        {
            countByFonte.TryGetValue(InboxOrigem.Email, out var c0) ? c0 : 0,
            countByFonte.TryGetValue(InboxOrigem.Pasta, out var c1) ? c1 : 0,
            countByFonte.TryGetValue(InboxOrigem.Upload, out var c2) ? c2 : 0
        };

        var headers = new[]
        {
            _localizer["ControllerLabels.RecebidoEm"].Value,
            _localizer["ControllerLabels.Origem"].Value,
            _localizer["ControllerLabels.Remetente"].Value,
            _localizer["ControllerLabels.Assunto"].Value,
            _localizer["ControllerLabels.Vaga"].Value,
            _localizer["ControllerLabels.Status"].Value
        };
        var rows = list.Select(c => new List<ReportCellResponse>
        {
            MakeCell(c.RecebidoEm.ToString("dd/MM/yyyy")),
            MakeCell(MapInboxOrigem(c.Origem)),
            MakeCell(c.Remetente),
            MakeCell(c.Assunto, "mono"),
            MakeCell(FormatVaga(c.VagaTitulo, c.VagaCodigo)),
            MakeInboxStatusCell(c.Status)
        }).ToList();

        return Ok(new ReportDataResponse(labels, values, headers, rows));
    }

    [HttpGet("falhas-processamento")]
    public async Task<ActionResult<ReportDataResponse>> GetFalhasProcessamento(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildInboxQuery(db, period, vagaId, origem, status, q, EffectiveCentroCustoId, EffectiveRecrutadorUserId)
            .Where(x => x.Status == InboxStatus.Falha);

        var list = await query
            .OrderByDescending(x => x.RecebidoEm)
            .Take(30)
            .Select(x => new
            {
                x.RecebidoEm,
                x.Origem,
                x.Assunto,
                VagaTitulo = x.Vaga != null ? x.Vaga.Titulo : null,
                VagaCodigo = x.Vaga != null ? x.Vaga.Codigo : null,
                x.ProcessamentoUltimoErro
            })
            .ToListAsync(ct);

        var grouped = list
            .GroupBy(x => string.IsNullOrWhiteSpace(x.ProcessamentoUltimoErro)
                ? _localizer["ControllerLabels.Outros"].Value
                : x.ProcessamentoUltimoErro)
            .OrderByDescending(x => x.Count())
            .Take(6)
            .ToList();

        var labels = grouped.Select(g => g.Key.Length > 22 ? g.Key[..22] + "..." : g.Key).ToList();
        var values = grouped.Select(g => g.Count()).ToList();

        var headers = new[]
        {
            _localizer["ControllerLabels.RecebidoEm"].Value,
            _localizer["ControllerLabels.Origem"].Value,
            _localizer["ControllerLabels.Assunto"].Value,
            _localizer["ControllerLabels.Vaga"].Value,
            _localizer["ControllerLabels.Erro"].Value
        };
        var rows = list.Select(x => new List<ReportCellResponse>
        {
            MakeCell(x.RecebidoEm.ToString("dd/MM/yyyy")),
            MakeCell(MapInboxOrigem(x.Origem)),
            MakeCell(x.Assunto),
            MakeCell(FormatVaga(x.VagaTitulo, x.VagaCodigo)),
            MakeCell(x.ProcessamentoUltimoErro ?? "-")
        }).ToList();

        return Ok(new ReportDataResponse(labels, values, headers, rows));
    }

    [HttpGet("pipeline-status")]
    public async Task<ActionResult<ReportDataResponse>> GetPipelineStatus(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildCandidateQuery(db, period, vagaId, origem, status, q, EffectiveCentroCustoId, EffectiveRecrutadorUserId);

        var list = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .Take(30)
            .Select(c => new
            {
                c.CreatedAtUtc,
                c.Nome,
                c.Email,
                c.Status,
                VagaTitulo = c.Vaga != null ? c.Vaga.Titulo : null,
                VagaCodigo = c.Vaga != null ? c.Vaga.Codigo : null
            })
            .ToListAsync(ct);

        var grouped = await query
            .GroupBy(c => c.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var labels = grouped.Select(g => MapStatusLabel(g.Status)).ToList();
        var values = grouped.Select(g => g.Count).ToList();

        var headers = new[]
        {
            _localizer["ControllerLabels.CriadoEm"].Value,
            _localizer["ControllerLabels.Nome"].Value,
            _localizer["ControllerLabels.Email"].Value,
            _localizer["ControllerLabels.Status"].Value,
            _localizer["ControllerLabels.Vaga"].Value
        };
        var rows = list.Select(c => new List<ReportCellResponse>
        {
            MakeCell(c.CreatedAtUtc.ToString("dd/MM/yyyy")),
            MakeCell(c.Nome),
            MakeCell(c.Email, "mono"),
            MakeStatusCell(c.Status),
            MakeCell(FormatVaga(c.VagaTitulo, c.VagaCodigo))
        }).ToList();

        return Ok(new ReportDataResponse(labels, values, headers, rows));
    }

    [HttpGet("funil-vaga")]
    public async Task<ActionResult<ReportDataResponse>> GetFunilPorVaga(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken ct)
    {
        var query = BuildCandidateQuery(db, period, vagaId, origem, status, q, EffectiveCentroCustoId, EffectiveRecrutadorUserId);

        var grouped = await query
            .GroupBy(c => new { c.VagaId, Titulo = c.Vaga != null ? c.Vaga.Titulo : null, Codigo = c.Vaga != null ? c.Vaga.Codigo : null })
            .Select(g => new
            {
                g.Key.VagaId,
                g.Key.Titulo,
                g.Key.Codigo,
                Total = g.Count(),
                Triagem = g.Count(x => x.Status == CandidateStatus.Triagem),
                Aprovados = g.Count(x => x.Status == CandidateStatus.Aprovado),
                Reprovados = g.Count(x => x.Status == CandidateStatus.Reprovado)
            })
            .OrderByDescending(x => x.Total)
            .Take(8)
            .ToListAsync(ct);

        var labels = grouped.Select(g => g.Codigo ?? _localizer["ControllerLabels.Vaga"].Value).ToList();
        var values = grouped.Select(g => g.Total).ToList();

        var headers = new[]
        {
            _localizer["ControllerLabels.Vaga"].Value,
            _localizer["ControllerLabels.Recebidos"].Value,
            _localizer["ControllerLabels.Triagem"].Value,
            _localizer["ControllerLabels.Aprovados"].Value,
            _localizer["ControllerLabels.Reprovados"].Value,
            _localizer["ControllerLabels.TaxaOk"].Value
        };
        var rows = grouped.Select(g =>
        {
            var rate = g.Total > 0 ? (int)Math.Round((double)g.Aprovados / g.Total * 100) : 0;
            var badge = rate >= 70
                ? MakeTagCell($"{rate}%", "ok", "bi-check2-circle")
                : rate >= 40
                    ? MakeTagCell($"{rate}%", "warn", "bi-exclamation-circle")
                    : MakeTagCell($"{rate}%", "bad", "bi-x-circle");

            return new List<ReportCellResponse>
            {
                MakeCell(FormatVaga(g.Titulo, g.Codigo)),
                MakeCell(g.Total.ToString(), "fw-semibold"),
                MakeCell(g.Triagem.ToString(), "fw-semibold"),
                MakeCell(g.Aprovados.ToString(), "fw-semibold text-success"),
                MakeCell(g.Reprovados.ToString(), "fw-semibold text-danger"),
                badge
            };
        }).ToList();

        return Ok(new ReportDataResponse(labels, values, headers, rows));
    }

    [HttpGet("ranking-matching")]
    public async Task<ActionResult<ReportDataResponse>> GetRankingMatching(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? vagaId,
        [FromQuery] string? origem,
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] int take,
        CancellationToken ct)
    {
        var safeTake = Math.Clamp(take <= 0 ? 12 : take, 1, 50);
        var query = BuildCandidateQuery(db, period, vagaId, origem, status, q, EffectiveCentroCustoId, EffectiveRecrutadorUserId)
            .Where(c => c.LastMatchScore != null);

        var list = await query
            .OrderByDescending(c => c.LastMatchScore)
            .ThenByDescending(c => c.UpdatedAtUtc)
            .Take(safeTake)
            .Select(c => new
            {
                c.Nome,
                c.Email,
                VagaTitulo = c.Vaga != null ? c.Vaga.Titulo : null,
                VagaCodigo = c.Vaga != null ? c.Vaga.Codigo : null,
                MatchScore = c.LastMatchScore ?? 0,
                UpdatedAt = c.UpdatedAtUtc
            })
            .ToListAsync(ct);

        var labels = list.Take(6).Select(c => (c.Nome ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "-").ToList();
        var values = list.Take(6).Select(c => c.MatchScore).ToList();

        var headers = new[]
        {
            _localizer["ControllerLabels.Candidato"].Value,
            _localizer["ControllerLabels.Email"].Value,
            _localizer["ControllerLabels.Vaga"].Value,
            _localizer["ControllerLabels.Match"].Value,
            _localizer["ControllerLabels.Atualizado"].Value
        };
        var rows = list.Select(c =>
        {
            var badge = c.MatchScore >= 80
                ? MakeTagCell($"{c.MatchScore}%", "ok", "bi-stars")
                : c.MatchScore >= 60
                    ? MakeTagCell($"{c.MatchScore}%", "warn", "bi-stars")
                    : MakeTagCell($"{c.MatchScore}%", "bad", "bi-stars");

            return new List<ReportCellResponse>
            {
                MakeCell(c.Nome),
                MakeCell(c.Email, "mono"),
                MakeCell(FormatVaga(c.VagaTitulo, c.VagaCodigo)),
                badge,
                MakeCell(c.UpdatedAt.ToString("dd/MM/yyyy"))
            };
        }).ToList();

        return Ok(new ReportDataResponse(labels, values, headers, rows));
    }

    [HttpGet("sla-vaga")]
    [ProducesResponseType(typeof(SlaVagaReportResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<SlaVagaReportResponse>> GetSlaVaga(
        [FromServices] AppDbContext db,
        [FromServices] IOptions<SlaVagaOptions> slaOptions,
        [FromQuery] string? period,
        [FromQuery] Guid? areaId,
        [FromQuery] string? recrutador,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var opts = slaOptions.Value;
        var start = PeriodStart(period);
        var now = DateTimeOffset.UtcNow;
        var effectiveAreaId = EffectiveCentroCustoId ?? areaId;

        var query = db.Vagas.AsNoTracking()
            .Include(v => v.CentroCusto)
            .Where(v => v.DataAbertura != null && v.DataAbertura >= start);

        if (effectiveAreaId.HasValue && effectiveAreaId.Value != Guid.Empty)
            query = query.Where(v => v.CentroCustoId == effectiveAreaId.Value);

        if (EffectiveRecrutadorUserId is { } recrutadorUserId)
            query = query.Where(v => v.RecrutadorResponsavelUserId == recrutadorUserId);

        if (!string.IsNullOrWhiteSpace(recrutador))
        {
            var r = recrutador.Trim().ToLower();
            query = query.Where(v => v.RecrutadorResponsavel != null && v.RecrutadorResponsavel.ToLower().Contains(r));
        }

        if (TryParseEnum<VagaStatus>(status, out var vagaStatus))
            query = query.Where(v => v.Status == vagaStatus);

        var vagas = await query.ToListAsync(ct);

        int Meta(Vaga v) => SlaVagaMetaResolver.GetDiasMeta(v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade, opts);

        var withSla = vagas.Select(v =>
        {
            var meta = Meta(v);
            var dias = (now - v.DataAbertura!.Value).TotalDays;
            bool encerrada = v.Status == VagaStatus.Encerrada;
            var diasAteFechar = encerrada ? (v.UpdatedAtUtc - v.DataAbertura.Value).TotalDays : (double?)null;
            var dentro = encerrada ? (diasAteFechar!.Value <= meta ? 1 : 0) : (dias <= meta ? 1 : 0);
            var fora = encerrada ? (diasAteFechar!.Value > meta ? 1 : 0) : (dias > meta ? 1 : 0);
            var rec = string.IsNullOrWhiteSpace(v.RecrutadorResponsavel) ? "(sem recrutador)" : v.RecrutadorResponsavel!;
            var areaNome = v.CentroCusto?.Description ?? v.CentroCustoId.ToString();
            return new { v, meta, diasAteFechar, dentro, fora, rec, areaNome };
        }).ToList();

        var porRecrutador = withSla
            .GroupBy(x => x.rec)
            .Select(g =>
            {
                var total = g.Count();
                var dentro = g.Sum(x => x.dentro);
                var fora = g.Sum(x => x.fora);
                var medias = g.Where(x => x.diasAteFechar.HasValue).Select(x => x.diasAteFechar!.Value).ToList();
                var media = medias.Count > 0 ? medias.Average() : (double?)null;
                return new SlaVagaReportRowResponse(g.Key, total, dentro, fora, media);
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        var porArea = withSla
            .GroupBy(x => x.areaNome)
            .Select(g =>
            {
                var total = g.Count();
                var dentro = g.Sum(x => x.dentro);
                var fora = g.Sum(x => x.fora);
                var medias = g.Where(x => x.diasAteFechar.HasValue).Select(x => x.diasAteFechar!.Value).ToList();
                var media = medias.Count > 0 ? medias.Average() : (double?)null;
                return new SlaVagaReportRowResponse(g.Key ?? string.Empty, total, dentro, fora, media);
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        return Ok(new SlaVagaReportResponse(porRecrutador, porArea, opts.DiasMetaFechamento));
    }

    // ══════════════════════════════════════════════════════════════════
    // Lookup para filtros de relatórios de gestão
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("unidades-lotacao")]
    public async Task<ActionResult<IReadOnlyList<ReportLotacaoLookupResponse>>> GetUnidadesLotacao(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var items = await db.UnidadesLotacao.AsNoTracking()
            .Where(u => u.IsActive)
            .OrderBy(u => u.Description)
            .Select(u => new ReportLotacaoLookupResponse(u.Id, u.Description))
            .ToListAsync(ct);

        return Ok(items);
    }

    // ══════════════════════════════════════════════════════════════════
    // r7 — Movimentação de headcount
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("headcount-movimentacao")]
    public async Task<ActionResult<ReportDataResponse>> GetHeadcountMovimentacao(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? unidadeLotacaoId,
        [FromQuery] bool compareYear,
        CancellationToken ct)
    {
        var (start, end) = PeriodRange(period);

        async Task<List<MovimentacaoRow>> FetchMovimentacoes(DateTimeOffset s, DateTimeOffset e)
        {
            var rows = new List<MovimentacaoRow>();
            var sDate = DateOnly.FromDateTime(s.UtcDateTime);
            var eDate = DateOnly.FromDateTime(e.UtcDateTime);

            // Entradas via Funcionario.DataAdmissao
            var entradas = await db.Funcionarios.AsNoTracking()
                .Include(f => f.UnidadeLotacao)
                .Where(f => f.DataAdmissao != null
                         && f.DataAdmissao.Value >= sDate
                         && f.DataAdmissao.Value <= eDate
                         && (!unidadeLotacaoId.HasValue || f.UnidadeLotacaoId == unidadeLotacaoId))
                .ToListAsync(ct);

            foreach (var f in entradas)
                rows.Add(new MovimentacaoRow(
                    f.DataAdmissao!.Value.ToString("dd/MM/yyyy"),
                    "Entrada",
                    f.Name,
                    "-",
                    f.UnidadeLotacao?.Description ?? "-"));

            // Saídas via SolicitacaoDesligamento
            var saidas = await db.SolicitacoesDesligamento.AsNoTracking()
                .Include(d => d.Funcionario).ThenInclude(f => f!.UnidadeLotacao)
                .Where(d => d.Status == SolicitacaoStatus.Aprovada
                         && d.DataDesligamento >= sDate
                         && d.DataDesligamento <= eDate
                         && (!unidadeLotacaoId.HasValue || d.Funcionario!.UnidadeLotacaoId == unidadeLotacaoId))
                .ToListAsync(ct);

            foreach (var d in saidas)
                rows.Add(new MovimentacaoRow(
                    d.DataDesligamento.ToString("dd/MM/yyyy"),
                    "Saída",
                    d.Funcionario?.Name ?? "-",
                    MapTipoDesligamento(d.TipoDesligamento),
                    d.Funcionario?.UnidadeLotacao?.Description ?? "-"));

            // Transferências e promoções via SolicitacaoPromocao
            var promocoes = await db.SolicitacoesPromocao.AsNoTracking()
                .Include(p => p.Funcionario).ThenInclude(f => f!.UnidadeLotacao)
                .Include(p => p.CargoAtual)
                .Include(p => p.NovoCargo)
                .Include(p => p.UnidadeLotacao)
                .Where(p => p.Status == SolicitacaoStatus.Aprovada
                         && p.DataEfetiva >= sDate
                         && p.DataEfetiva <= eDate
                         && (!unidadeLotacaoId.HasValue
                             || p.Funcionario!.UnidadeLotacaoId == unidadeLotacaoId
                             || p.UnidadeLotacaoId == unidadeLotacaoId))
                .ToListAsync(ct);

            foreach (var p in promocoes)
            {
                var tipo = (p.UnidadeLotacaoId.HasValue && p.UnidadeLotacaoId != p.Funcionario?.UnidadeLotacaoId)
                    ? "Transferência" : "Promoção";
                var de = p.CargoAtual?.Name ?? "-";
                var para = p.NovoCargo?.Name ?? "-";
                rows.Add(new MovimentacaoRow(
                    p.DataEfetiva.ToString("dd/MM/yyyy"),
                    tipo,
                    p.Funcionario?.Name ?? "-",
                    $"{de} → {para}",
                    p.UnidadeLotacao?.Description ?? p.Funcionario?.UnidadeLotacao?.Description ?? "-"));
            }

            return rows.OrderByDescending(r => r.Data).ToList();
        }

        var current = await FetchMovimentacoes(start, end);

        var headers = new[] { "Data", "Tipo", "Colaborador", "Detalhe", "Lotação" };
        IReadOnlyList<string> extHeaders = headers;
        List<IReadOnlyList<ReportCellResponse>> extRows = current.Select(r =>
            (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
            {
                MakeCell(r.Data),
                MakeMovimentacaoTypeCell(r.Tipo),
                MakeCell(r.Colaborador),
                MakeCell(r.Detalhe),
                MakeCell(r.Lotacao)
            }).ToList();

        if (compareYear)
        {
            var prev = await FetchMovimentacoes(start.AddYears(-1), end.AddYears(-1));
            var tiposAtual = current.GroupBy(r => r.Tipo).ToDictionary(g => g.Key, g => g.Count());
            var tiposPrev = prev.GroupBy(r => r.Tipo).ToDictionary(g => g.Key, g => g.Count());
            var tiposAll = tiposAtual.Keys.Union(tiposPrev.Keys).Distinct().ToList();

            extHeaders = new[] { "Tipo", "Período Atual", "Período Anterior", "Variação" };
            extRows = tiposAll.Select(tipo =>
            {
                var a = tiposAtual.GetValueOrDefault(tipo, 0);
                var p = tiposPrev.GetValueOrDefault(tipo, 0);
                var delta = a - p;
                var deltaCell = delta > 0 ? MakeTagCell($"+{delta}", "ok", "bi-arrow-up")
                    : delta < 0 ? MakeTagCell($"{delta}", "bad", "bi-arrow-down")
                    : MakeCell("=");
                return (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
                {
                    MakeCell(tipo), MakeCell(a.ToString(), "fw-semibold"), MakeCell(p.ToString()), deltaCell
                };
            }).ToList();
        }

        var byTipo = current.GroupBy(r => r.Tipo).ToList();
        return Ok(new ReportDataResponse(
            byTipo.Select(g => g.Key).ToList(),
            byTipo.Select(g => g.Count()).ToList(),
            extHeaders, extRows));
    }

    // ══════════════════════════════════════════════════════════════════
    // r8 — Turnover e retenção
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("turnover-retencao")]
    public async Task<ActionResult<ReportDataResponse>> GetTurnoverRetencao(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? unidadeLotacaoId,
        CancellationToken ct)
    {
        var start = PeriodStart(period);
        var endDate = DateOnly.FromDateTime(DateTimeOffset.UtcNow.UtcDateTime);
        var startDate = DateOnly.FromDateTime(start.UtcDateTime);

        var query = db.SolicitacoesDesligamento.AsNoTracking()
            .Include(d => d.Funcionario).ThenInclude(f => f!.UnidadeLotacao)
            .Include(d => d.Funcionario).ThenInclude(f => f!.JobPosition)
            .Where(d => d.Status == SolicitacaoStatus.Aprovada
                     && d.DataDesligamento >= startDate
                     && d.DataDesligamento <= endDate
                     && (!unidadeLotacaoId.HasValue || d.Funcionario!.UnidadeLotacaoId == unidadeLotacaoId));

        var list = await query.ToListAsync(ct);

        static bool IsVoluntario(TipoDesligamento t) =>
            t == TipoDesligamento.PedidoDemissao || t == TipoDesligamento.AcordoMutuo;

        var voluntarios = list.Count(d => IsVoluntario(d.TipoDesligamento));
        var involuntarios = list.Count - voluntarios;

        var totalAtivos = await db.Funcionarios.AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active
                     && (!unidadeLotacaoId.HasValue || f.UnidadeLotacaoId == unidadeLotacaoId))
            .CountAsync(ct);

        var taxaTurnover = totalAtivos > 0 ? Math.Round((double)list.Count / totalAtivos * 100, 1) : 0.0;

        var summaryRow = (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
        {
            MakeTagCell($"Taxa: {taxaTurnover}%", "warn", "bi-percent"),
            MakeCell($"{list.Count} desligamentos"),
            MakeCell($"{voluntarios} vol."),
            MakeCell($"{involuntarios} invol."),
            MakeCell($"HC ativo: {totalAtivos}"),
            MakeCell("")
        };

        var headers = new[] { "Data", "Colaborador", "Tipo", "Motivo", "Lotação", "Cargo" };
        var rows = list.OrderByDescending(d => d.DataDesligamento).Take(50)
            .Select(d => (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
            {
                MakeCell(d.DataDesligamento.ToString("dd/MM/yyyy")),
                MakeCell(d.Funcionario?.Name ?? "-"),
                MakeDesligamentoTypeCell(d.TipoDesligamento),
                MakeCell(d.MotivoDesligamento),
                MakeCell(d.Funcionario?.UnidadeLotacao?.Description ?? "-"),
                MakeCell(d.Funcionario?.JobPosition?.Name ?? "-")
            }).ToList();

        return Ok(new ReportDataResponse(
            new[] { "Voluntário", "Involuntário" },
            new[] { voluntarios, involuntarios },
            headers,
            new[] { summaryRow }.Concat(rows).ToList()));
    }

    // ══════════════════════════════════════════════════════════════════
    // r9 — Tempo médio de contratação (TTH)
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("tth-contratacao")]
    public async Task<ActionResult<ReportDataResponse>> GetTthContratacao(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? unidadeLotacaoId,
        CancellationToken ct)
    {
        var start = PeriodStart(period);

        var vagasQuery = db.Vagas.AsNoTracking()
            .Include(v => v.UnidadeLotacao)
            .Where(v => v.DataAbertura != null && v.DataAbertura >= start);

        if (unidadeLotacaoId.HasValue)
            vagasQuery = vagasQuery.Where(v => v.UnidadeLotacaoId == unidadeLotacaoId);

        if (EffectiveRecrutadorUserId is { } recId)
            vagasQuery = vagasQuery.Where(v => v.RecrutadorResponsavelUserId == recId);

        var vagas = await vagasQuery.ToListAsync(ct);
        var vagaIds = vagas.Select(v => v.Id).ToHashSet();

        var candidatos = await db.Candidatos.AsNoTracking()
            .Where(c => c.VagaId != null && vagaIds.Contains(c.VagaId.Value)
                     && c.Status == CandidateStatus.Aprovado)
            .ToListAsync(ct);

        var candidatoIds = candidatos.Select(c => c.Id).ToHashSet();

        var preAdmissoes = await db.PreAdmissoes.AsNoTracking()
            .Where(p => p.CandidatoId != null
                     && candidatoIds.Contains(p.CandidatoId.Value)
                     && p.Status == PreAdmissaoStatus.Aprovada
                     && p.DataAdmissao != null)
            .ToListAsync(ct);

        var candidatoToVaga = candidatos.Where(c => c.VagaId.HasValue)
            .ToDictionary(c => c.Id, c => c.VagaId!.Value);

        var tthRows = new List<TthRow>();
        foreach (var pa in preAdmissoes)
        {
            if (pa.CandidatoId == null) continue;
            if (!candidatoToVaga.TryGetValue(pa.CandidatoId.Value, out var vagaId)) continue;
            var vaga = vagas.FirstOrDefault(v => v.Id == vagaId);
            if (vaga?.DataAbertura == null || pa.DataAdmissao == null) continue;

            var tth = (pa.DataAdmissao.Value.ToDateTime(TimeOnly.MinValue) - vaga.DataAbertura.Value.UtcDateTime).TotalDays;
            if (tth >= 0)
                tthRows.Add(new TthRow(
                    vaga.Titulo ?? "-",
                    vaga.Codigo ?? "-",
                    vaga.UnidadeLotacao?.Description ?? "-",
                    vaga.RecrutadorResponsavel ?? "(sem recrutador)",
                    vaga.TipoContratacao?.ToString() ?? "-",
                    (int)Math.Round(tth)));
        }

        var byLotacao = tthRows.GroupBy(r => r.Lotacao)
            .Select(g => (Lotacao: g.Key, Media: g.Average(r => r.TthDias)))
            .OrderByDescending(x => x.Media).Take(8).ToList();

        var headers = new[] { "Vaga", "Cód.", "Lotação", "Recrutador", "Tipo Contrato", "TTH (dias)" };
        var tableRows = tthRows.OrderBy(r => r.TthDias).Take(30).Select(r =>
        {
            var badge = r.TthDias <= 30 ? MakeTagCell($"{r.TthDias}d", "ok", "bi-check2-circle")
                : r.TthDias <= 60 ? MakeTagCell($"{r.TthDias}d", "warn", "bi-exclamation-circle")
                : MakeTagCell($"{r.TthDias}d", "bad", "bi-x-circle");
            return (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
            {
                MakeCell(r.Titulo), MakeCell(r.Codigo, "mono"),
                MakeCell(r.Lotacao), MakeCell(r.Recrutador),
                MakeCell(r.TipoContrato), badge
            };
        }).ToList();

        return Ok(new ReportDataResponse(
            byLotacao.Select(x => x.Lotacao).ToList(),
            byLotacao.Select(x => (int)Math.Round(x.Media)).ToList(),
            headers, tableRows));
    }

    // ══════════════════════════════════════════════════════════════════
    // r10 — Headcount plan vs. real
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("headcount-plan-real")]
    public async Task<ActionResult<ReportDataResponse>> GetHeadcountPlanReal(
        [FromServices] AppDbContext db,
        [FromQuery] Guid? unidadeLotacaoId,
        CancellationToken ct)
    {
        // "Plan" = vagas estruturais, agrupadas por Unidade de Lotação
        var vagasQuery = db.Vagas.AsNoTracking()
            .Include(v => v.UnidadeLotacao)
            .Where(v => v.IsEstrutural);

        if (unidadeLotacaoId.HasValue)
            vagasQuery = vagasQuery.Where(v => v.UnidadeLotacaoId == unidadeLotacaoId);

        var vagasPlan = await vagasQuery
            .GroupBy(v => new { v.UnidadeLotacaoId, Nome = v.UnidadeLotacao != null ? v.UnidadeLotacao.Description : "-" })
            .Select(g => new { g.Key.UnidadeLotacaoId, g.Key.Nome, Plan = g.Sum(v => v.QuantidadeVagas) })
            .ToListAsync(ct);

        // "Real" = funcionários ativos, agrupados por Unidade de Lotação
        var funcQuery = db.Funcionarios.AsNoTracking()
            .Include(f => f.UnidadeLotacao)
            .Where(f => f.Status == FuncionarioStatus.Active);

        if (unidadeLotacaoId.HasValue)
            funcQuery = funcQuery.Where(f => f.UnidadeLotacaoId == unidadeLotacaoId);

        var funcReal = await funcQuery
            .GroupBy(f => new { f.UnidadeLotacaoId, Nome = f.UnidadeLotacao != null ? f.UnidadeLotacao.Description : "-" })
            .Select(g => new { g.Key.UnidadeLotacaoId, g.Key.Nome, Real = g.Count() })
            .ToListAsync(ct);

        var allIds = vagasPlan.Select(x => x.UnidadeLotacaoId)
            .Union(funcReal.Select(x => x.UnidadeLotacaoId)).Distinct().ToList();

        var planMap = vagasPlan.ToDictionary(x => x.UnidadeLotacaoId, x => (x.Nome, x.Plan));
        var realMap = funcReal.ToDictionary(x => x.UnidadeLotacaoId, x => (x.Nome, x.Real));

        var merged = allIds.Select(lid =>
        {
            planMap.TryGetValue(lid, out var pd);
            realMap.TryGetValue(lid, out var rd);
            var nome = !string.IsNullOrEmpty(pd.Nome) ? pd.Nome : !string.IsNullOrEmpty(rd.Nome) ? rd.Nome : "-";
            return (Nome: nome, Plan: pd.Plan, Real: rd.Real, Gap: pd.Plan - rd.Real);
        }).OrderBy(x => x.Nome).ToList();

        var headers = new[] { "Lotação", "Orçado", "Real (ativo)", "Gap", "% Ocupação" };
        var rows = merged.Select(x =>
        {
            var pct = x.Plan > 0 ? Math.Round((double)x.Real / x.Plan * 100, 0) : 0.0;
            var gapCell = x.Gap > 0 ? MakeTagCell($"-{x.Gap}", "warn", "bi-dash-circle")
                : x.Gap < 0 ? MakeTagCell($"+{Math.Abs(x.Gap)}", "bad", "bi-exclamation-circle")
                : MakeTagCell("Ok", "ok", "bi-check2-circle");
            var pctCell = pct >= 90 ? MakeTagCell($"{pct}%", "ok", "bi-check2-circle")
                : pct >= 70 ? MakeTagCell($"{pct}%", "warn", "bi-exclamation-circle")
                : MakeTagCell($"{pct}%", "bad", "bi-x-circle");
            return (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
            {
                MakeCell(x.Nome), MakeCell(x.Plan.ToString(), "fw-semibold"),
                MakeCell(x.Real.ToString(), "fw-semibold"), gapCell, pctCell
            };
        }).ToList();

        return Ok(new ReportDataResponse(
            merged.Select(x => x.Nome).ToList(),
            merged.Select(x => x.Gap).ToList(),
            headers, rows));
    }

    // ══════════════════════════════════════════════════════════════════
    // r11 — Pirâmide etária e diversidade
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("piramide-etaria")]
    public async Task<ActionResult<ReportDataResponse>> GetPiramideEtaria(
        [FromServices] AppDbContext db,
        [FromQuery] Guid? unidadeLotacaoId,
        CancellationToken ct)
    {
        var query = db.Funcionarios.AsNoTracking()
            .Where(f => f.Status == FuncionarioStatus.Active && f.DataNascimento != null);

        if (unidadeLotacaoId.HasValue)
            query = query.Where(f => f.UnidadeLotacaoId == unidadeLotacaoId);

        var list = await query.Select(f => new { f.DataNascimento, f.Sexo }).ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.Today);

        static int CalcIdade(DateOnly n, DateOnly h)
        {
            var a = h.Year - n.Year;
            if (n.AddYears(a) > h) a--;
            return a;
        }

        static string Bucket(int i) => i switch
        {
            < 25 => "< 25", < 35 => "25–34", < 45 => "35–44", < 55 => "45–54", _ => "55+"
        };

        var byBucket = list
            .Select(f => new { B = Bucket(CalcIdade(f.DataNascimento!.Value, today)), S = f.Sexo ?? "N.I." })
            .GroupBy(x => x.B).OrderBy(g => g.Key).ToList();

        var headers = new[] { "Faixa Etária", "Total", "Masc.", "Fem.", "N.I." };
        var rows = byBucket.Select(g =>
        {
            var m = g.Count(x => x.S.ToUpper() == "M");
            var f = g.Count(x => x.S.ToUpper() == "F");
            var ni = g.Count() - m - f;
            return (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
            {
                MakeCell(g.Key, "fw-semibold"), MakeCell(g.Count().ToString(), "fw-semibold"),
                MakeCell(m.ToString()), MakeCell(f.ToString()),
                MakeCell(ni > 0 ? ni.ToString() : "-")
            };
        }).ToList();

        var totalM = list.Count(x => (x.Sexo ?? "").ToUpper() == "M");
        var totalF = list.Count(x => (x.Sexo ?? "").ToUpper() == "F");
        rows.Add((IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
        {
            MakeCell("Total", "fw-bold border-top"), MakeCell(list.Count.ToString(), "fw-bold"),
            MakeCell(totalM.ToString(), "fw-semibold"), MakeCell(totalF.ToString(), "fw-semibold"),
            MakeCell((list.Count - totalM - totalF) is > 0 and var ni2 ? ni2.ToString() : "-")
        });

        return Ok(new ReportDataResponse(
            byBucket.Select(g => g.Key).ToList(),
            byBucket.Select(g => g.Count()).ToList(),
            headers, rows));
    }

    // ══════════════════════════════════════════════════════════════════
    // r12 — Promoções e movimentações salariais
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("promocoes-salariais")]
    public async Task<ActionResult<ReportDataResponse>> GetPromocoesSalariais(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? unidadeLotacaoId,
        CancellationToken ct)
    {
        var startDate = DateOnly.FromDateTime(PeriodStart(period).UtcDateTime);

        var query = db.SolicitacoesPromocao.AsNoTracking()
            .Include(p => p.Funcionario).ThenInclude(f => f!.UnidadeLotacao)
            .Include(p => p.CargoAtual)
            .Include(p => p.NovoCargo)
            .Include(p => p.UnidadeLotacao)
            .Where(p => p.Status == SolicitacaoStatus.Aprovada && p.DataEfetiva >= startDate
                     && (!unidadeLotacaoId.HasValue
                         || p.Funcionario!.UnidadeLotacaoId == unidadeLotacaoId
                         || p.UnidadeLotacaoId == unidadeLotacaoId));

        var list = await query.OrderByDescending(p => p.DataEfetiva).Take(50).ToListAsync(ct);

        var byLotacao = list
            .GroupBy(p => p.UnidadeLotacao?.Description ?? p.Funcionario?.UnidadeLotacao?.Description ?? "-")
            .OrderByDescending(g => g.Count()).Take(8).ToList();

        var headers = new[] { "Data", "Colaborador", "Cargo Anterior", "Novo Cargo", "Lotação", "Novo Salário" };
        var rows = list.Select(p =>
        {
            var salario = p.NovoSalario.HasValue ? $"R$ {p.NovoSalario.Value:N2}" : "-";
            return (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
            {
                MakeCell(p.DataEfetiva.ToString("dd/MM/yyyy")),
                MakeCell(p.Funcionario?.Name ?? "-"),
                MakeCell(p.CargoAtual?.Name ?? "-"),
                MakeCell(p.NovoCargo?.Name ?? "-", "fw-semibold"),
                MakeCell(p.UnidadeLotacao?.Description ?? p.Funcionario?.UnidadeLotacao?.Description ?? "-"),
                MakeCell(salario, p.NovoSalario.HasValue ? "mono" : null)
            };
        }).ToList();

        return Ok(new ReportDataResponse(
            byLotacao.Select(g => g.Key).ToList(),
            byLotacao.Select(g => g.Count()).ToList(),
            headers, rows));
    }

    // ══════════════════════════════════════════════════════════════════
    // r13 — Relatório de férias
    // ══════════════════════════════════════════════════════════════════

    [HttpGet("ferias-overview")]
    public async Task<ActionResult<ReportDataResponse>> GetFeriasOverview(
        [FromServices] AppDbContext db,
        [FromQuery] string? period,
        [FromQuery] Guid? unidadeLotacaoId,
        CancellationToken ct)
    {
        var startDate = DateOnly.FromDateTime(PeriodStart(period).UtcDateTime);

        var query = db.SolicitacoesFerias.AsNoTracking()
            .Include(f => f.Solicitante).ThenInclude(s => s!.UnidadeLotacao)
            .Where(f => f.DataInicio >= startDate
                     && (!unidadeLotacaoId.HasValue || f.Solicitante!.UnidadeLotacaoId == unidadeLotacaoId));

        var list = await query.OrderByDescending(f => f.DataInicio).Take(50).ToListAsync(ct);

        var byLotacao = list
            .Where(f => f.Status == SolicitacaoStatus.Aprovada)
            .GroupBy(f => f.Solicitante?.UnidadeLotacao?.Description ?? "-")
            .Select(g => (Lotacao: g.Key, Dias: g.Sum(f => f.QtdDias)))
            .OrderByDescending(x => x.Dias).Take(8).ToList();

        var headers = new[] { "Colaborador", "Lotação", "Período Aq.", "Início", "Fim", "Dias", "Status" };
        var rows = list.Select(f =>
        {
            var statusCell = f.Status switch
            {
                SolicitacaoStatus.Aprovada => MakeTagCell("Aprovada", "ok", "bi-check2-circle"),
                SolicitacaoStatus.PendenteAprovacao or SolicitacaoStatus.PendenteAprovacaoRh
                    => MakeTagCell("Pendente", "warn", "bi-hourglass-split"),
                SolicitacaoStatus.Reprovada => MakeTagCell("Reprovada", "bad", "bi-x-circle"),
                _ => MakeCell(f.Status.ToString())
            };
            return (IReadOnlyList<ReportCellResponse>)new List<ReportCellResponse>
            {
                MakeCell(f.Solicitante?.Name ?? "-"),
                MakeCell(f.Solicitante?.UnidadeLotacao?.Description ?? "-"),
                MakeCell(f.PeriodoAquisitivo ?? "-"),
                MakeCell(f.DataInicio.ToString("dd/MM/yyyy")),
                MakeCell(f.DataFim.ToString("dd/MM/yyyy")),
                MakeCell(f.QtdDias.ToString(), "fw-semibold"),
                statusCell
            };
        }).ToList();

        return Ok(new ReportDataResponse(
            byLotacao.Select(x => x.Lotacao).ToList(),
            byLotacao.Select(x => x.Dias).ToList(),
            headers, rows));
    }

    // ── Helpers de mapeamento para relatórios de gestão ──

    private static ReportCellResponse MakeMovimentacaoTypeCell(string tipo) => tipo switch
    {
        "Entrada" => MakeTagCell(tipo, "ok", "bi-person-plus"),
        "Saída" => MakeTagCell(tipo, "bad", "bi-person-dash"),
        "Transferência" => MakeTagCell(tipo, "warn", "bi-arrow-left-right"),
        "Promoção" => MakeTagCell(tipo, "ok", "bi-arrow-up-circle"),
        _ => MakeTagCell(tipo, "", "bi-dot")
    };

    private ReportCellResponse MakeDesligamentoTypeCell(TipoDesligamento tipo)
    {
        var label = MapTipoDesligamento(tipo);
        return tipo == TipoDesligamento.PedidoDemissao || tipo == TipoDesligamento.AcordoMutuo
            ? MakeTagCell(label, "warn", "bi-person-dash")
            : MakeTagCell(label, "bad", "bi-x-circle");
    }

    private static string MapTipoDesligamento(TipoDesligamento tipo) => tipo switch
    {
        TipoDesligamento.PedidoDemissao => "Pedido de demissão",
        TipoDesligamento.AcordoMutuo => "Acordo mútuo",
        TipoDesligamento.SemJustaCausa => "Sem justa causa",
        TipoDesligamento.JustaCausa => "Justa causa",
        TipoDesligamento.FimContrato => "Fim de contrato",
        _ => tipo.ToString()
    };

    private static (DateTimeOffset Start, DateTimeOffset End) PeriodRange(string? period)
    {
        var end = DateTimeOffset.UtcNow;
        return (PeriodStart(period), end);
    }

    // ── Value objects internos ──

    private sealed record MovimentacaoRow(string Data, string Tipo, string Colaborador, string Detalhe, string Lotacao);
    private sealed record TthRow(string Titulo, string Codigo, string Lotacao, string Recrutador, string TipoContrato, int TthDias);

    private static IQueryable<RhPortal.Api.Domain.Entities.Candidato> BuildCandidateQuery(
        AppDbContext db,
        string? period,
        Guid? vagaId,
        string? origem,
        string? status,
        string? q,
        Guid? areaId,
        Guid? recrutadorUserId)
    {
        var start = PeriodStart(period);
        var query = db.Candidatos.AsNoTracking()
            .Include(c => c.Vaga)
            .Where(c => c.CreatedAtUtc >= start);

        if (vagaId.HasValue)
            query = query.Where(c => c.VagaId == vagaId.Value);

        if (areaId.HasValue && areaId.Value != Guid.Empty)
            query = query.Where(c => c.Vaga != null && c.Vaga.CentroCustoId == areaId.Value);

        if (recrutadorUserId.HasValue && recrutadorUserId.Value != Guid.Empty)
            query = query.Where(c => c.Vaga != null && c.Vaga.RecrutadorResponsavelUserId == recrutadorUserId.Value);

        if (TryParseEnum<CandidateOrigin>(origem, out var fonte))
            query = query.Where(c => c.Fonte == fonte);

        if (TryParseEnum<CandidateStatus>(status, out var candStatus))
            query = query.Where(c => c.Status == candStatus);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var text = q.Trim().ToLower();
            query = query.Where(c =>
                c.Nome.ToLower().Contains(text) ||
                c.Email.ToLower().Contains(text) ||
                (c.Vaga != null && ((c.Vaga.Titulo ?? "").ToLower().Contains(text) ||
                                    (c.Vaga.Codigo ?? "").ToLower().Contains(text))));
        }

        return query;
    }

    private static IQueryable<InboxItem> BuildInboxQuery(
        AppDbContext db,
        string? period,
        Guid? vagaId,
        string? origem,
        string? status,
        string? q,
        Guid? areaId,
        Guid? recrutadorUserId)
    {
        var start = PeriodStart(period);
        var query = db.InboxItems.AsNoTracking()
            .Include(x => x.Vaga)
            .Where(x => x.RecebidoEm >= start);

        if (vagaId.HasValue)
            query = query.Where(x => x.VagaId == vagaId.Value);

        if (areaId.HasValue && areaId.Value != Guid.Empty)
            query = query.Where(x => x.Vaga != null && x.Vaga.CentroCustoId == areaId.Value);

        if (recrutadorUserId.HasValue && recrutadorUserId.Value != Guid.Empty)
            query = query.Where(x => x.Vaga != null && x.Vaga.RecrutadorResponsavelUserId == recrutadorUserId.Value);

        if (TryParseEnum<InboxOrigem>(origem, out var parsedOrigem))
            query = query.Where(x => x.Origem == parsedOrigem);

        if (TryParseEnum<InboxStatus>(status, out var parsedStatus))
            query = query.Where(x => x.Status == parsedStatus);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var text = q.Trim().ToLower();
            query = query.Where(x =>
                (x.Remetente ?? "").ToLower().Contains(text) ||
                (x.Assunto ?? "").ToLower().Contains(text) ||
                (x.Destinatario ?? "").ToLower().Contains(text));
        }

        return query;
    }

    private static DateTimeOffset PeriodStart(string? period)
    {
        var now = DateTimeOffset.UtcNow;
        return period switch
        {
            "7d" => now.AddDays(-7),
            "30d" => now.AddDays(-30),
            "90d" => now.AddDays(-90),
            "ytd" => new DateTimeOffset(new DateTime(now.Year, 1, 1), TimeSpan.Zero),
            _ => now.AddDays(-30)
        };
    }

    private static bool TryParseEnum<TEnum>(string? value, out TEnum result) where TEnum : struct
    {
        result = default;
        if (string.IsNullOrWhiteSpace(value) || value == "all")
            return false;
        return Enum.TryParse(value, true, out result);
    }

    private string MapOrigem(CandidateOrigin fonte)
    {
        return fonte switch
        {
            CandidateOrigin.Email => _localizer["ControllerLabels.Email"].Value,
            CandidateOrigin.Pasta => _localizer["ControllerLabels.Pasta"].Value,
            CandidateOrigin.LinkedIn => _localizer["ControllerLabels.LinkedIn"].Value,
            CandidateOrigin.Indicacao => _localizer["ControllerLabels.Indicacao"].Value,
            CandidateOrigin.Site => _localizer["ControllerLabels.Site"].Value,
            _ => _localizer["ControllerLabels.Outro"].Value
        };
    }

    private string MapInboxOrigem(InboxOrigem origem)
    {
        return origem switch
        {
            InboxOrigem.Email => _localizer["ControllerLabels.Email"].Value,
            InboxOrigem.Pasta => _localizer["ControllerLabels.Pasta"].Value,
            InboxOrigem.Upload => _localizer["ControllerLabels.Upload"].Value,
            _ => _localizer["ControllerLabels.Outro"].Value
        };
    }

    private string MapStatusLabel(CandidateStatus status)
    {
        return status switch
        {
            CandidateStatus.Novo => _localizer["ControllerLabels.StatusNovo"].Value,
            CandidateStatus.Triagem => _localizer["ControllerLabels.StatusTriagem"].Value,
            CandidateStatus.Pendente => _localizer["ControllerLabels.StatusPendente"].Value,
            CandidateStatus.Aprovado => _localizer["ControllerLabels.StatusAprovado"].Value,
            CandidateStatus.Reprovado => _localizer["ControllerLabels.StatusReprovado"].Value,
            _ => _localizer["ControllerLabels.Outro"].Value
        };
    }

    private static ReportCellResponse MakeCell(string? text, string? className = null)
        => new(text ?? string.Empty, className, null);

    private static ReportCellResponse MakeTagCell(string text, string cls, string icon)
        => new(text, new[] { "tag", cls }.Where(x => !string.IsNullOrWhiteSpace(x)).Aggregate(string.Empty, (a,b) => string.IsNullOrEmpty(a) ? b : $"{a} {b}"), icon);

    private ReportCellResponse MakeStatusCell(CandidateStatus status)
    {
        var label = MapStatusLabel(status);
        return status switch
        {
            CandidateStatus.Aprovado => MakeTagCell(label, "ok", "bi-check2-circle"),
            CandidateStatus.Reprovado => MakeTagCell(label, "bad", "bi-x-circle"),
            CandidateStatus.Pendente => MakeTagCell(label, "warn", "bi-exclamation-circle"),
            _ => MakeTagCell(label, string.Empty, "bi-dot")
        };
    }

    private ReportCellResponse MakeInboxStatusCell(InboxStatus status)
    {
        var label = status switch
        {
            InboxStatus.Novo => _localizer["ControllerLabels.StatusNovo"].Value,
            InboxStatus.Processando => _localizer["ControllerLabels.StatusProcessando"].Value,
            InboxStatus.Processado => _localizer["ControllerLabels.StatusProcessado"].Value,
            InboxStatus.Falha => _localizer["ControllerLabels.StatusFalha"].Value,
            InboxStatus.Descartado => _localizer["ControllerLabels.StatusDescartado"].Value,
            _ => _localizer["ControllerLabels.Outro"].Value
        };

        return status switch
        {
            InboxStatus.Processado => MakeTagCell(label, "ok", "bi-check2-circle"),
            InboxStatus.Processando => MakeTagCell(label, "warn", "bi-arrow-repeat"),
            InboxStatus.Falha => MakeTagCell(label, "bad", "bi-exclamation-triangle"),
            InboxStatus.Descartado => MakeTagCell(label, "bad", "bi-trash3"),
            _ => MakeTagCell(label, string.Empty, "bi-dot")
        };
    }

    private static string FormatVaga(string? titulo, string? codigo)
    {
        var title = string.IsNullOrWhiteSpace(titulo) ? "-" : titulo;
        var code = string.IsNullOrWhiteSpace(codigo) ? "-" : codigo;
        return $"{title} ({code})";
    }
}
