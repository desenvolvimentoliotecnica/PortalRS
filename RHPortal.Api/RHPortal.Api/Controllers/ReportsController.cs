using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Reports;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Rm;
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

    [HttpGet("funcionarios-rm")]
    [RequirePermission("relatorios.view")]
    [ProducesResponseType(typeof(FuncionarioRmReportResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FuncionarioRmReportResponse>> GetFuncionariosRm(
        [FromServices] AppDbContext db,
        [FromServices] IOptions<RmConnectionOptions> rmOptions,
        [FromQuery] string? q,
        [FromQuery] string? status,
        [FromQuery] bool somenteRm = true,
        [FromQuery] bool incluirMovimentacoes = false,
        [FromQuery] int take = 5000,
        CancellationToken ct = default)
    {
        var safeTake = Math.Clamp(take <= 0 ? 5000 : take, 1, 10000);
        var query = db.Funcionarios
            .AsNoTracking()
            .Include(f => f.Pessoa)
            .Include(f => f.CentroCusto)
            .Include(f => f.JobPosition)
            .Include(f => f.Unit)
            .Include(f => f.GestorDireto)
            .Include(f => f.NivelHierarquico)
            .Include(f => f.NivelCargo)
            .Include(f => f.Hierarquia)
            .AsQueryable();

        if (somenteRm)
            query = query.Where(f => f.MatriculaRm != null && f.MatriculaRm != "");

        if (TryParseEnum<FuncionarioStatus>(status, out var parsedStatus))
            query = query.Where(f => f.Status == parsedStatus);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var text = q.Trim().ToLower();
            query = query.Where(f =>
                f.Name.ToLower().Contains(text) ||
                (f.Email != null && f.Email.ToLower().Contains(text)) ||
                (f.MatriculaRm != null && f.MatriculaRm.ToLower().Contains(text)) ||
                (f.CdnFuncionario != null && f.CdnFuncionario.ToLower().Contains(text)) ||
                (f.CdnEmpresa != null && f.CdnEmpresa.ToLower().Contains(text)) ||
                (f.CdnEstab != null && f.CdnEstab.ToLower().Contains(text)) ||
                (f.CodSituacaoRm != null && f.CodSituacaoRm.ToLower().Contains(text)) ||
                (f.SituacaoRmDescricao != null && f.SituacaoRmDescricao.ToLower().Contains(text)) ||
                (f.FuncaoNomeRm != null && f.FuncaoNomeRm.ToLower().Contains(text)) ||
                (f.Pessoa != null && f.Pessoa.Cpf != null && f.Pessoa.Cpf.ToLower().Contains(text)) ||
                (f.CentroCusto != null && (
                    f.CentroCusto.Code.ToLower().Contains(text) ||
                    f.CentroCusto.Description.ToLower().Contains(text))) ||
                (f.JobPosition != null && (
                    f.JobPosition.Code.ToLower().Contains(text) ||
                    f.JobPosition.Name.ToLower().Contains(text))) ||
                (f.GestorDireto != null && f.GestorDireto.Name.ToLower().Contains(text)) ||
                (f.Hierarquia != null && f.Hierarquia.Descricao.ToLower().Contains(text)));
        }

        var totalItems = await query.CountAsync(ct);
        var funcionarios = await query
            .OrderBy(f => f.Name)
            .ThenBy(f => f.MatriculaRm)
            .Take(safeTake)
            .ToListAsync(ct);

        var funcionarioIds = funcionarios.Select(f => f.Id).ToList();
        var salariosAtuaisRmByFuncionarioId = await LoadSalariosAtuaisFromRmAsync(rmOptions.Value, funcionarios, ct);
        var salariosAtuais = await db.FuncionarioMovimentacoes
            .AsNoTracking()
            .Where(m => m.FuncionarioId != null
                && funcionarioIds.Contains(m.FuncionarioId.Value)
                && m.SalarioDestino != null)
            .OrderByDescending(m => m.DataConclusao ?? m.DataAbertura)
            .ThenByDescending(m => m.UpdatedAtUtc)
            .Select(m => new { FuncionarioId = m.FuncionarioId!.Value, m.SalarioDestino })
            .ToListAsync(ct);
        var salarioAtualByFuncionarioId = salariosAtuais
            .GroupBy(x => x.FuncionarioId)
            .ToDictionary(g => g.Key, g => g.First().SalarioDestino);

        var empresaDescricaoByCode = await db.Empresas
            .AsNoTracking()
            .Select(e => new { e.Code, e.Description })
            .ToListAsync(ct);
        var estabDescricaoByCode = await db.Units
            .AsNoTracking()
            .Select(u => new { u.Code, Description = u.Name })
            .ToListAsync(ct);
        var centroCustoDescricaoByCode = await db.CentrosCusto
            .AsNoTracking()
            .Select(c => new { c.Code, c.Description })
            .ToListAsync(ct);

        static void AddCode(Dictionary<string, string> map, string? code, string? description)
        {
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(description))
                return;
            var trimmed = code.Trim();
            map.TryAdd(trimmed, description.Trim());
            if (int.TryParse(trimmed, out var numeric))
            {
                map.TryAdd(numeric.ToString(), description.Trim());
                map.TryAdd(numeric.ToString("00"), description.Trim());
            }
        }

        var empresaDescricaoMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in empresaDescricaoByCode)
            AddCode(empresaDescricaoMap, item.Code, item.Description);

        var estabDescricaoMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in estabDescricaoByCode)
            AddCode(estabDescricaoMap, item.Code, item.Description);
        foreach (var item in empresaDescricaoByCode)
            AddCode(estabDescricaoMap, item.Code, item.Description);

        var centroCustoDescricaoMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in centroCustoDescricaoByCode)
            AddCode(centroCustoDescricaoMap, item.Code, item.Description);

        static DateOnly? AsDateOnly(DateTime? value) =>
            value.HasValue ? DateOnly.FromDateTime(value.Value) : null;

        static string? LookupDescription(Dictionary<string, string> map, string? code)
        {
            if (string.IsNullOrWhiteSpace(code)) return null;
            return map.TryGetValue(code.Trim(), out var description) ? description : null;
        }

        static string? FormatCodeDescription(string? code, string? description)
        {
            var trimmedCode = code?.Trim();
            var trimmedDescription = description?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedCode)) return string.IsNullOrWhiteSpace(trimmedDescription) ? null : trimmedDescription;
            if (string.IsNullOrWhiteSpace(trimmedDescription)) return trimmedCode;
            return $"{trimmedCode} - {trimmedDescription}";
        }

        static string? FormatTwoDigitCodeDescription(string? code, string? description)
        {
            var trimmedCode = code?.Trim();
            if (!string.IsNullOrWhiteSpace(trimmedCode) && int.TryParse(trimmedCode, out var numeric))
                trimmedCode = numeric.ToString("00", System.Globalization.CultureInfo.InvariantCulture);
            return FormatCodeDescription(trimmedCode, description);
        }

        static string? EstadoCivilDescricao(string? code) => code?.Trim() switch
        {
            "0" => "Não informado",
            "1" => "Solteiro(a)",
            "2" => "Casado(a)",
            "3" => "Divorciado(a)",
            "4" => "Viúvo(a)",
            "5" => "União estável",
            "6" => "Separado(a)",
            "C" => "Casado(a)",
            "D" => "Divorciado(a)",
            "I" => "Divorciado(a)",
            "O" => "Outros",
            "P" => "Separado(a)",
            "S" => "Solteiro(a)",
            "U" => "União estável",
            "V" => "Viúvo(a)",
            null or "" => null,
            var value => $"Código {value}"
        };

        static string? NacionalidadeDescricao(string? code) => code?.Trim() switch
        {
            "10" => "Brasileira",
            null or "" => null,
            var value => $"Código {value}"
        };

        static DateTime MovementDate(FuncionarioMovimentacao mov) =>
            mov.DataConclusao ?? mov.DataAbertura;

        static string? FormatDuration(int? days)
        {
            if (!days.HasValue) return null;
            var years = days.Value / 365;
            var months = (days.Value % 365) / 30;
            var remainingDays = (days.Value % 365) % 30;
            if (years > 0) return $"{years}a {months}m {remainingDays}d";
            if (months > 0) return $"{months}m {remainingDays}d";
            return $"{remainingDays}d";
        }

        FuncionarioRmReportRowResponse BuildRow(
            Funcionario f,
            FuncionarioMovimentacao? mov,
            (DateTime? Inicio, DateTime? Fim, int? Dias, decimal? SalarioAnterior, decimal? DiferencaSalario, decimal? PercentualSalario)? calc = null)
        {
            var pessoa = f.Pessoa;
            var nivelNome = f.NivelHierarquico?.Nome
                ?? f.NivelCargo?.NomComplet
                ?? f.JobPosition?.NivelCargo?.NomComplet
                ?? f.CdnNivCargo?.ToString();

            return new FuncionarioRmReportRowResponse(
                FormatTwoDigitCodeDescription(f.CdnEmpresa, LookupDescription(empresaDescricaoMap, f.CdnEmpresa) ?? (string.IsNullOrWhiteSpace(f.CdnEmpresa) ? null : $"Coligada {f.CdnEmpresa}")),
                LookupDescription(empresaDescricaoMap, f.CdnEmpresa) ?? (string.IsNullOrWhiteSpace(f.CdnEmpresa) ? null : $"Coligada {f.CdnEmpresa}"),
                FormatTwoDigitCodeDescription(f.CdnEstab, LookupDescription(estabDescricaoMap, f.CdnEstab)),
                LookupDescription(estabDescricaoMap, f.CdnEstab),
                f.CdnFuncionario,
                f.MatriculaRm,
                f.Name,
                f.Email,
                f.Phone,
                f.Status.ToString(),
                FormatCodeDescription(f.CodSituacaoRm, f.SituacaoRmDescricao),
                f.SituacaoRmDescricao,
                f.DataAdmissao,
                f.DataNascimento ?? AsDateOnly(pessoa?.DataNascimento),
                f.Sexo ?? pessoa?.Sexo,
                pessoa?.Cpf,
                FormatCodeDescription(pessoa?.EstadoCivil, EstadoCivilDescricao(pessoa?.EstadoCivil)),
                EstadoCivilDescricao(pessoa?.EstadoCivil),
                pessoa?.GrauInstrucao,
                pessoa?.Naturalidade,
                pessoa?.EstadoNatal,
                pessoa?.Cep,
                pessoa?.Logradouro,
                pessoa?.Numero,
                pessoa?.Complemento,
                pessoa?.Bairro,
                pessoa?.Cidade,
                pessoa?.Uf,
                pessoa?.Rg,
                pessoa?.RgOrgEmissor,
                pessoa?.RgUf,
                pessoa?.RgDataEmissao,
                pessoa?.CarteiraTrabalho,
                pessoa?.CarteiraTrabalhoSerie,
                pessoa?.CarteiraTrabalhoUf,
                pessoa?.CarteiraTrabalhoData,
                pessoa?.NumeroPis,
                pessoa?.TituloEleitor,
                pessoa?.TituloEleitorZona,
                pessoa?.TituloEleitorSecao,
                pessoa?.CertificadoReservista,
                pessoa?.CategoriaMilitar,
                FormatCodeDescription(pessoa?.Nacionalidade, NacionalidadeDescricao(pessoa?.Nacionalidade)),
                NacionalidadeDescricao(pessoa?.Nacionalidade),
                pessoa?.NomePai,
                pessoa?.NomeMae,
                FormatCodeDescription(f.CentroCusto?.Code, f.CentroCusto?.Description),
                f.CentroCusto?.Description,
                FormatCodeDescription(f.JobPosition?.Code, f.JobPosition?.Name),
                f.JobPosition?.Name,
                FormatCodeDescription(f.CodFuncaoRm, f.FuncaoNomeRm),
                f.FuncaoNomeRm,
                salariosAtuaisRmByFuncionarioId.TryGetValue(f.Id, out var salarioRm)
                    ? salarioRm
                    : salarioAtualByFuncionarioId.GetValueOrDefault(f.Id),
                f.Unit?.Name,
                f.GestorDireto?.Name,
                nivelNome,
                f.Hierarquia?.Descricao,
                f.HasIncompleteData,
                f.UpdatedAtUtc,
                mov?.IdReqRm,
                mov?.TipoDescricao,
                mov?.TipoDescricao,
                mov?.DataAbertura,
                mov?.DataConclusao,
                mov is null ? null : FormatCodeDescription(mov.CodStatus.ToString(System.Globalization.CultureInfo.InvariantCulture), mov.StatusDescricao),
                mov?.StatusDescricao,
                FormatCodeDescription(mov?.CodFuncaoOrigem, mov?.FuncaoOrigemNome ?? (mov?.CodFuncaoOrigem == f.CodFuncaoRm ? f.FuncaoNomeRm : null)),
                FormatCodeDescription(mov?.CodFuncaoDestino, mov?.FuncaoDestinoNome ?? (mov?.CodFuncaoDestino == f.CodFuncaoRm ? f.FuncaoNomeRm : null)),
                FormatCodeDescription(mov?.CodSecaoOrigem, LookupDescription(centroCustoDescricaoMap, mov?.CodSecaoOrigem)),
                FormatCodeDescription(mov?.CodSecaoDestino, LookupDescription(centroCustoDescricaoMap, mov?.CodSecaoDestino)),
                mov?.FuncaoOrigemNome ?? (mov?.CodFuncaoOrigem == f.CodFuncaoRm ? f.FuncaoNomeRm : null),
                mov?.FuncaoDestinoNome ?? (mov?.CodFuncaoDestino == f.CodFuncaoRm ? f.FuncaoNomeRm : null),
                LookupDescription(centroCustoDescricaoMap, mov?.CodSecaoOrigem),
                LookupDescription(centroCustoDescricaoMap, mov?.CodSecaoDestino),
                mov?.SalarioOrigem,
                mov?.SalarioDestino,
                calc?.Inicio,
                calc?.Fim,
                calc?.Dias,
                FormatDuration(calc?.Dias),
                calc?.SalarioAnterior,
                calc?.DiferencaSalario,
                calc?.PercentualSalario,
                FormatCodeDescription(mov?.GestorHistoricoChapaRm, mov?.GestorHistoricoNome),
                mov?.GestorHistoricoNome,
                null,
                null,
                mov?.Justificativa,
                mov?.GerouSubstituicao);
        }

        static FuncionarioMovimentacao EnrichGestorHistorico(
            FuncionarioMovimentacao mov,
            IReadOnlyDictionary<string, (string? Chapa, string? Nome)> gestoresHistoricosRm)
        {
            if (gestoresHistoricosRm.TryGetValue(mov.IdReqRm, out var gestor))
            {
                mov.GestorHistoricoChapaRm = gestor.Chapa;
                mov.GestorHistoricoNome = gestor.Nome;
            }

            return mov;
        }

        var rows = new List<FuncionarioRmReportRowResponse>();
        if (incluirMovimentacoes)
        {
            var movimentacoes = await db.FuncionarioMovimentacoes
                .AsNoTracking()
                .Where(m => m.FuncionarioId != null && funcionarioIds.Contains(m.FuncionarioId.Value))
                .OrderBy(m => m.FuncionarioId)
                .ThenByDescending(m => m.DataConclusao ?? m.DataAbertura)
                .ThenByDescending(m => m.UpdatedAtUtc)
                .ToListAsync(ct);
            var historicoSalarialRm = await LoadHistoricoSalarialFromRmAsync(rmOptions.Value, funcionarios, movimentacoes, ct);
            movimentacoes.AddRange(historicoSalarialRm);
            var gestoresHistoricosRm = await LoadGestoresHistoricosFromRmAsync(rmOptions.Value, movimentacoes, ct);
            var movimentacoesByFuncionario = movimentacoes
                .GroupBy(m => m.FuncionarioId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            foreach (var funcionario in funcionarios)
            {
                if (movimentacoesByFuncionario.TryGetValue(funcionario.Id, out var movimentos) && movimentos.Count > 0)
                {
                    var movimentosCronologicos = movimentos
                        .OrderBy(MovementDate)
                        .ThenBy(m => m.UpdatedAtUtc)
                        .ToList();
                    var calculos = new Dictionary<Guid, (DateTime? Inicio, DateTime? Fim, int? Dias, decimal? SalarioAnterior, decimal? DiferencaSalario, decimal? PercentualSalario)>();
                    decimal? ultimoSalarioDestino = null;
                    for (var i = 0; i < movimentosCronologicos.Count; i++)
                    {
                        var atual = movimentosCronologicos[i];
                        var inicio = MovementDate(atual);
                        DateTime? fim = i + 1 < movimentosCronologicos.Count
                            ? MovementDate(movimentosCronologicos[i + 1])
                            : atual.TipoMovimentacao == 5
                                ? atual.DataConclusao ?? atual.DataAbertura
                                : DateTime.UtcNow;
                        int? dias = fim.HasValue && fim.Value >= inicio
                            ? (int)Math.Floor((fim.Value.Date - inicio.Date).TotalDays)
                            : null;
                        var salarioAnterior = atual.SalarioOrigem ?? ultimoSalarioDestino;
                        var salarioReferencia = atual.SalarioDestino;
                        var diferencaSalario = salarioReferencia.HasValue && salarioAnterior.HasValue
                            ? salarioReferencia.Value - salarioAnterior.Value
                            : (decimal?)null;
                        var percentualSalario = diferencaSalario.HasValue && salarioAnterior.HasValue && salarioAnterior.Value != 0
                            ? Math.Round((diferencaSalario.Value / salarioAnterior.Value) * 100, 2)
                            : (decimal?)null;

                        calculos[atual.Id] = (inicio, fim, dias, salarioAnterior, diferencaSalario, percentualSalario);
                        if (atual.SalarioDestino.HasValue)
                            ultimoSalarioDestino = atual.SalarioDestino;
                    }

                    rows.AddRange(movimentosCronologicos
                        .OrderByDescending(MovementDate)
                        .ThenByDescending(m => m.UpdatedAtUtc)
                        .Select(m => BuildRow(funcionario, EnrichGestorHistorico(m, gestoresHistoricosRm), calculos.GetValueOrDefault(m.Id))));
                }
                else
                {
                    rows.Add(BuildRow(funcionario, null));
                }
            }
        }
        else
        {
            rows = funcionarios.Select(f => BuildRow(f, null)).ToList();
        }

        return Ok(new FuncionarioRmReportResponse(
            DateTimeOffset.UtcNow,
            totalItems,
            incluirMovimentacoes
                ? FuncionarioRmReportColumns.Concat(FuncionarioRmReportMovimentacaoColumns).ToList()
                : FuncionarioRmReportColumns,
            rows));
    }

    [HttpGet("funcionarios-rm-live")]
    [RequirePermission("relatorios.view")]
    [ProducesResponseType(typeof(FuncionarioRmReportResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FuncionarioRmReportResponse>> GetFuncionariosRmLive(
        [FromServices] IOptions<RmConnectionOptions> rmOptions,
        [FromQuery] string? q,
        [FromQuery] string? status,
        [FromQuery] bool somenteRm = true,
        [FromQuery] bool incluirMovimentacoes = false,
        [FromQuery] int take = 5000,
        CancellationToken ct = default)
    {
        var safeTake = Math.Clamp(take <= 0 ? 5000 : take, 1, 10000);
        var (funcionarios, totalItems) = await LoadFuncionariosRmLiveAsync(rmOptions.Value, q, status, safeTake, ct);

        var movements = incluirMovimentacoes
            ? await LoadMovimentacoesRmLiveAsync(rmOptions.Value, funcionarios, ct)
            : [];
        var movementsByEmployee = movements
            .GroupBy(m => LiveEmployeeKey(m.CodColigada, m.Chapa))
            .ToDictionary(g => g.Key, g => g.OrderBy(LiveMovementDate).ThenBy(m => m.IdReqRm).ToList(), StringComparer.OrdinalIgnoreCase);

        static DateOnly? AsDateOnly(DateTime? value) =>
            value.HasValue ? DateOnly.FromDateTime(value.Value) : null;

        static string? EstadoCivilDescricao(string? code) => code?.Trim() switch
        {
            "0" => "Não informado",
            "1" => "Solteiro(a)",
            "2" => "Casado(a)",
            "3" => "Divorciado(a)",
            "4" => "Viúvo(a)",
            "5" => "União estável",
            "6" => "Separado(a)",
            "C" => "Casado(a)",
            "D" => "Divorciado(a)",
            "I" => "Divorciado(a)",
            "O" => "Outros",
            "P" => "Separado(a)",
            "S" => "Solteiro(a)",
            "U" => "União estável",
            "V" => "Viúvo(a)",
            null or "" => null,
            var value => $"Código {value}"
        };

        static string? NacionalidadeDescricao(string? code) => code?.Trim() switch
        {
            "10" => "Brasileira",
            null or "" => null,
            var value => $"Código {value}"
        };

        static string? FormatDuration(int? days)
        {
            if (!days.HasValue) return null;
            var years = days.Value / 365;
            var months = (days.Value % 365) / 30;
            var remainingDays = (days.Value % 365) % 30;
            if (years > 0) return $"{years}a {months}m {remainingDays}d";
            if (months > 0) return $"{months}m {remainingDays}d";
            return $"{remainingDays}d";
        }

        static FuncionarioRmReportRowResponse BuildRow(
            LiveFuncionarioRm f,
            LiveMovimentacaoRm? mov,
            (DateTime? Inicio, DateTime? Fim, int? Dias, decimal? SalarioAnterior, decimal? DiferencaSalario, decimal? PercentualSalario)? calc = null)
        {
            return new FuncionarioRmReportRowResponse(
                FormatTwoDigitCodeDescription(f.CodColigada, f.EmpresaDescricao),
                f.EmpresaDescricao,
                FormatTwoDigitCodeDescription(f.CodFilial, f.FilialDescricao),
                f.FilialDescricao,
                f.Chapa,
                f.Chapa,
                f.Nome,
                f.Email,
                f.Telefone,
                f.StatusPortal,
                FormatCodeDescription(f.CodSituacao, f.SituacaoDescricao),
                f.SituacaoDescricao,
                AsDateOnly(f.DataAdmissao),
                AsDateOnly(f.DataNascimento),
                f.Sexo,
                f.Cpf,
                FormatCodeDescription(f.EstadoCivil, EstadoCivilDescricao(f.EstadoCivil)),
                EstadoCivilDescricao(f.EstadoCivil),
                f.GrauInstrucao,
                f.Naturalidade,
                f.EstadoNatal,
                f.Cep,
                f.Logradouro,
                f.NumeroEndereco,
                f.Complemento,
                f.Bairro,
                f.Cidade,
                f.Uf,
                f.Rg,
                f.RgOrgEmissor,
                f.RgUf,
                f.RgDataEmissao,
                f.CarteiraTrabalho,
                f.CarteiraTrabalhoSerie,
                f.CarteiraTrabalhoUf,
                f.CarteiraTrabalhoData,
                f.NumeroPis,
                f.TituloEleitor,
                f.TituloEleitorZona,
                f.TituloEleitorSecao,
                f.CertificadoReservista,
                f.CategoriaMilitar,
                FormatCodeDescription(f.Nacionalidade, NacionalidadeDescricao(f.Nacionalidade)),
                NacionalidadeDescricao(f.Nacionalidade),
                f.NomePai,
                f.NomeMae,
                FormatCodeDescription(f.CodSecao, f.CentroCustoDescricao),
                f.CentroCustoDescricao,
                FormatCodeDescription(f.CodigoCargo, f.CargoNome),
                f.CargoNome,
                FormatCodeDescription(f.CodFuncao, f.FuncaoNome),
                f.FuncaoNome,
                f.SalarioAtual,
                f.FilialDescricao,
                f.GestorDiretoNome,
                null,
                f.HierarquiaDescricao,
                false,
                DateTimeOffset.UtcNow,
                mov?.IdReqRm,
                mov?.TipoDescricao,
                mov?.TipoDescricao,
                mov?.DataAbertura,
                mov?.DataConclusao,
                mov is null ? null : FormatCodeDescription(mov.CodStatus.ToString(System.Globalization.CultureInfo.InvariantCulture), mov.StatusDescricao),
                mov?.StatusDescricao,
                FormatCodeDescription(mov?.CodFuncaoOrigem, mov?.FuncaoOrigemNome),
                FormatCodeDescription(mov?.CodFuncaoDestino, mov?.FuncaoDestinoNome),
                FormatCodeDescription(mov?.CodSecaoOrigem, mov?.SecaoOrigemDescricao),
                FormatCodeDescription(mov?.CodSecaoDestino, mov?.SecaoDestinoDescricao),
                mov?.FuncaoOrigemNome,
                mov?.FuncaoDestinoNome,
                mov?.SecaoOrigemDescricao,
                mov?.SecaoDestinoDescricao,
                mov?.SalarioOrigem,
                mov?.SalarioDestino,
                calc?.Inicio,
                calc?.Fim,
                calc?.Dias,
                FormatDuration(calc?.Dias),
                calc?.SalarioAnterior,
                calc?.DiferencaSalario,
                calc?.PercentualSalario,
                FormatCodeDescription(mov?.GestorHistoricoChapaRm, mov?.GestorHistoricoNome),
                mov?.GestorHistoricoNome,
                mov?.CargoOrigem,
                mov?.CargoDestino,
                mov?.Justificativa,
                mov?.GerouSubstituicao);
        }

        var rows = new List<FuncionarioRmReportRowResponse>();
        foreach (var funcionario in funcionarios)
        {
            if (incluirMovimentacoes && movementsByEmployee.TryGetValue(LiveEmployeeKey(funcionario.CodColigada, funcionario.Chapa), out var employeeMovements) && employeeMovements.Count > 0)
            {
                var calculos = new Dictionary<string, (DateTime? Inicio, DateTime? Fim, int? Dias, decimal? SalarioAnterior, decimal? DiferencaSalario, decimal? PercentualSalario)>(StringComparer.OrdinalIgnoreCase);
                decimal? ultimoSalarioDestino = null;
                for (var i = 0; i < employeeMovements.Count; i++)
                {
                    var atual = employeeMovements[i];
                    var inicio = LiveMovementDate(atual);
                    DateTime? fim = i + 1 < employeeMovements.Count
                        ? LiveMovementDate(employeeMovements[i + 1])
                        : atual.TipoMovimentacao == 5
                            ? atual.DataConclusao ?? atual.DataAbertura
                            : DateTime.UtcNow;
                    int? dias = fim.HasValue && fim.Value >= inicio
                        ? (int)Math.Floor((fim.Value.Date - inicio.Date).TotalDays)
                        : null;
                    var salarioAnterior = atual.SalarioOrigem ?? ultimoSalarioDestino;
                    var salarioReferencia = atual.SalarioDestino;
                    var diferencaSalario = salarioReferencia.HasValue && salarioAnterior.HasValue
                        ? salarioReferencia.Value - salarioAnterior.Value
                        : (decimal?)null;
                    var percentualSalario = diferencaSalario.HasValue && salarioAnterior.HasValue && salarioAnterior.Value != 0
                        ? Math.Round((diferencaSalario.Value / salarioAnterior.Value) * 100, 2)
                        : (decimal?)null;

                    calculos[atual.IdReqRm] = (inicio, fim, dias, salarioAnterior, diferencaSalario, percentualSalario);
                    if (atual.SalarioDestino.HasValue)
                        ultimoSalarioDestino = atual.SalarioDestino;
                }

                rows.AddRange(employeeMovements
                    .OrderByDescending(LiveMovementDate)
                    .ThenByDescending(m => m.IdReqRm)
                    .Select(m => BuildRow(funcionario, m, calculos.GetValueOrDefault(m.IdReqRm))));
            }
            else
            {
                rows.Add(BuildRow(funcionario, null));
            }
        }

        return Ok(new FuncionarioRmReportResponse(
            DateTimeOffset.UtcNow,
            totalItems,
            incluirMovimentacoes
                ? FuncionarioRmReportColumns.Concat(FuncionarioRmReportMovimentacaoColumns).ToList()
                : FuncionarioRmReportColumns,
            rows));
    }

    private static async Task<(List<LiveFuncionarioRm> Funcionarios, int TotalItems)> LoadFuncionariosRmLiveAsync(
        RmConnectionOptions options,
        string? q,
        string? status,
        int take,
        CancellationToken ct)
    {
        var where = new List<string>
        {
            "F.CHAPA IS NOT NULL",
            "LTRIM(RTRIM(F.CHAPA)) <> ''",
        };
        if (string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase))
            where.Add("F.CODSITUACAO IN ('A', 'F', 'P')");
        else if (string.Equals(status, "Inactive", StringComparison.OrdinalIgnoreCase))
            where.Add("(F.CODSITUACAO IS NULL OR F.CODSITUACAO NOT IN ('A', 'F', 'P'))");

        var hasSearch = !string.IsNullOrWhiteSpace(q);
        if (hasSearch)
        {
            where.Add("""
                (
                    F.CHAPA LIKE @Q OR
                    F.NOME LIKE @Q OR
                    P.NOME LIKE @Q OR
                    P.EMAIL LIKE @Q OR
                    P.CPF LIKE @Q OR
                    F.CODSITUACAO LIKE @Q OR
                    F.CODSECAO LIKE @Q OR
                    S.DESCRICAO LIKE @Q OR
                    F.CODFUNCAO LIKE @Q OR
                    FU.NOME LIKE @Q
                )
                """);
        }

        var sql = $"""
            SELECT TOP (@Take)
                COUNT(*) OVER() AS TotalItems,
                CAST(F.CODCOLIGADA AS varchar(20)) AS CODCOLIGADA,
                NULLIF(LTRIM(RTRIM(COALESCE(GC.NOMEFANTASIA, GC.NOME))), '') AS EMPRESADESCRICAO,
                NULLIF(LTRIM(RTRIM(F.CHAPA)), '') AS CHAPA,
                CAST(F.CODFILIAL AS varchar(20)) AS CODFILIAL,
                NULLIF(LTRIM(RTRIM(F.CODSITUACAO)), '') AS CODSITUACAO,
                F.DATAADMISSAO,
                NULLIF(LTRIM(RTRIM(COALESCE(P.NOME, F.NOME))), '') AS NOME,
                NULLIF(LTRIM(RTRIM(P.EMAIL)), '') AS EMAIL,
                NULLIF(LTRIM(RTRIM(P.CPF)), '') AS CPF,
                NULLIF(LTRIM(RTRIM(P.TELEFONE1)), '') AS TELEFONE,
                P.DTNASCIMENTO,
                NULLIF(LTRIM(RTRIM(P.SEXO)), '') AS SEXO,
                NULLIF(LTRIM(RTRIM(P.ESTADOCIVIL)), '') AS ESTADOCIVIL,
                NULLIF(LTRIM(RTRIM(P.NATURALIDADE)), '') AS NATURALIDADE,
                NULLIF(LTRIM(RTRIM(P.ESTADONATAL)), '') AS ESTADONATAL,
                NULLIF(LTRIM(RTRIM(P.GRAUINSTRUCAO)), '') AS GRAUINSTRUCAO,
                NULLIF(LTRIM(RTRIM(P.CEP)), '') AS CEP,
                NULLIF(LTRIM(RTRIM(P.RUA)), '') AS LOGRADOURO,
                NULLIF(LTRIM(RTRIM(P.NUMERO)), '') AS NUMEROENDERECO,
                NULLIF(LTRIM(RTRIM(P.COMPLEMENTO)), '') AS COMPLEMENTO,
                NULLIF(LTRIM(RTRIM(P.BAIRRO)), '') AS BAIRRO,
                NULLIF(LTRIM(RTRIM(P.CIDADE)), '') AS CIDADE,
                NULLIF(LTRIM(RTRIM(P.ESTADO)), '') AS UF,
                NULLIF(LTRIM(RTRIM(P.CARTIDENTIDADE)), '') AS RG,
                NULLIF(LTRIM(RTRIM(P.ORGEMISSORIDENT)), '') AS RGORGEMISSOR,
                NULLIF(LTRIM(RTRIM(P.UFCARTIDENT)), '') AS RGUF,
                P.DTEMISSAOIDENT AS RGDATAEMISSAO,
                NULLIF(LTRIM(RTRIM(P.CARTEIRATRAB)), '') AS CARTEIRATRABALHO,
                NULLIF(LTRIM(RTRIM(P.SERIECARTTRAB)), '') AS CARTEIRATRABALHOSERIE,
                NULLIF(LTRIM(RTRIM(P.UFCARTTRAB)), '') AS CARTEIRATRABALHOUF,
                P.DTCARTTRAB AS CARTEIRATRABALHODATA,
                NULLIF(LTRIM(RTRIM(P.NIT)), '') AS NUMEROPIS,
                NULLIF(LTRIM(RTRIM(P.TITULOELEITOR)), '') AS TITULOELEITOR,
                NULLIF(LTRIM(RTRIM(P.ZONATITELEITOR)), '') AS TITULOELEITORZONA,
                NULLIF(LTRIM(RTRIM(P.SECAOTITELEITOR)), '') AS TITULOELEITORSECAO,
                NULLIF(LTRIM(RTRIM(P.CERTIFRESERV)), '') AS CERTIFICADORESERVISTA,
                NULLIF(LTRIM(RTRIM(P.CATEGMILITAR)), '') AS CATEGORIAMILITAR,
                NULLIF(LTRIM(RTRIM(P.NACIONALIDADE)), '') AS NACIONALIDADE,
                COALESCE(
                    NULLIF(LTRIM(RTRIM(XPF.NOM_PAI)), ''),
                    NULLIF(LTRIM(RTRIM(PPAI.NOME)), ''),
                    NULLIF(LTRIM(RTRIM(CAND.PAI)), ''),
                    NULLIF(LTRIM(RTRIM(UCAND.PAI)), '')
                ) AS NOMEPAI,
                COALESCE(
                    NULLIF(LTRIM(RTRIM(XPF.NOM_MAE)), ''),
                    NULLIF(LTRIM(RTRIM(PMAE.NOME)), ''),
                    NULLIF(LTRIM(RTRIM(CAND.MAE)), ''),
                    NULLIF(LTRIM(RTRIM(UCAND.MAE)), '')
                ) AS NOMEMAE,
                NULLIF(LTRIM(RTRIM(F.CODSECAO)), '') AS CODSECAO,
                NULLIF(LTRIM(RTRIM(S.DESCRICAO)), '') AS CENTROCUSTODESCRICAO,
                NULLIF(LTRIM(RTRIM(F.CODFUNCAO)), '') AS CODFUNCAO,
                NULLIF(LTRIM(RTRIM(FU.NOME)), '') AS FUNCAONOME,
                NULLIF(LTRIM(RTRIM(FU.CARGO)), '') AS CODIGOCARGO,
                NULLIF(LTRIM(RTRIM(C.NOME)), '') AS CARGONOME,
                F.SALARIO AS SALARIOATUAL,
                NULLIF(LTRIM(RTRIM(G.NOMEFANTASIA)), '') AS FILIALDESCRICAO,
                NULLIF(LTRIM(RTRIM(COALESCE(PGEST.NOME, FGEST.NOME))), '') AS GESTORDIRETONOME
            FROM PFUNC F
            LEFT JOIN GCOLIGADA GC
                ON GC.CODCOLIGADA = F.CODCOLIGADA
            LEFT JOIN PPESSOA P
                ON P.CODIGO = F.CODPESSOA
            LEFT JOIN XPESSOAFISICA XPF
                ON XPF.COD_PESS = P.CODIGO
            LEFT JOIN SPESSOA SP
                ON SP.CODIGO = P.CODIGO
            LEFT JOIN PPESSOA PPAI
                ON PPAI.CODIGO = SP.CODPESSOAPAI
            LEFT JOIN PPESSOA PMAE
                ON PMAE.CODIGO = SP.CODPESSOAMAE
            OUTER APPLY (
                SELECT TOP 1 C.PAI, C.MAE
                FROM SCANDIDATOPROCSEL C
                WHERE (
                    P.CPF IS NOT NULL
                    AND REPLACE(REPLACE(REPLACE(C.CPFALUNO, '.', ''), '-', ''), '/', '') = REPLACE(REPLACE(REPLACE(P.CPF, '.', ''), '-', ''), '/', '')
                )
                OR C.NOME = COALESCE(P.NOME, F.NOME)
                ORDER BY C.RECMODIFIEDON DESC, C.RECCREATEDON DESC
            ) CAND
            OUTER APPLY (
                SELECT TOP 1 C.PAI, C.MAE
                FROM UCANDIDATOPROCSEL C
                WHERE (
                    P.CPF IS NOT NULL
                    AND REPLACE(REPLACE(REPLACE(C.CPFALUNO, '.', ''), '-', ''), '/', '') = REPLACE(REPLACE(REPLACE(P.CPF, '.', ''), '-', ''), '/', '')
                )
                OR C.NOME = COALESCE(P.NOME, F.NOME)
                ORDER BY C.RECMODIFIEDON DESC, C.RECCREATEDON DESC
            ) UCAND
            LEFT JOIN PSECAO S
                ON S.CODCOLIGADA = F.CODCOLIGADA
               AND S.CODIGO = F.CODSECAO
            LEFT JOIN PFUNCAO FU
                ON FU.CODCOLIGADA = F.CODCOLIGADA
               AND FU.CODIGO = F.CODFUNCAO
            LEFT JOIN PCARGO C
                ON C.CODCOLIGADA = F.CODCOLIGADA
               AND C.CODIGO = FU.CARGO
            LEFT JOIN GFILIAL G
                ON G.CODCOLIGADA = F.CODCOLIGADA
               AND G.CODFILIAL = F.CODFILIAL
            OUTER APPLY (
                SELECT TOP 1 L.CHAPALIDER
                FROM PFUNCLIDERHRPLATFORM L
                WHERE L.CODCOLIGADA = F.CODCOLIGADA
                  AND L.CHAPA = F.CHAPA
                  AND L.CHAPALIDER IS NOT NULL
                  AND L.CHAPALIDER <> F.CHAPA
                ORDER BY CASE WHEN ISNULL(L.[MASTER], 0) = 1 THEN 0 ELSE 1 END
            ) LIDER
            LEFT JOIN PFUNC FGEST
                ON FGEST.CODCOLIGADA = F.CODCOLIGADA
               AND FGEST.CHAPA = LIDER.CHAPALIDER
            LEFT JOIN PPESSOA PGEST
                ON PGEST.CODIGO = FGEST.CODPESSOA
            WHERE {string.Join(" AND ", where)}
            ORDER BY COALESCE(P.NOME, F.NOME), F.CHAPA;
            """;

        var funcionarios = new List<LiveFuncionarioRm>();
        var totalItems = 0;
        await using var conn = new SqlConnection(options.GetConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Take", take);
        if (hasSearch)
            cmd.Parameters.AddWithValue("@Q", $"%{q!.Trim()}%");

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            totalItems = DbInt(reader, "TotalItems") ?? totalItems;
            var codSituacao = DbString(reader, "CODSITUACAO");
            funcionarios.Add(new LiveFuncionarioRm(
                DbString(reader, "CODCOLIGADA"),
                DbString(reader, "CHAPA") ?? "",
                DbString(reader, "EMPRESADESCRICAO"),
                DbString(reader, "CODFILIAL"),
                codSituacao,
                SituacaoRmDescricao(codSituacao),
                IsRmActiveStatus(codSituacao) ? "Active" : "Inactive",
                DbDateTime(reader, "DATAADMISSAO"),
                DbString(reader, "NOME"),
                DbString(reader, "EMAIL"),
                DbString(reader, "TELEFONE"),
                DbString(reader, "CPF"),
                DbDateTime(reader, "DTNASCIMENTO"),
                DbString(reader, "SEXO"),
                DbString(reader, "ESTADOCIVIL"),
                DbString(reader, "GRAUINSTRUCAO"),
                DbString(reader, "NATURALIDADE"),
                DbString(reader, "ESTADONATAL"),
                DbString(reader, "CEP"),
                DbString(reader, "LOGRADOURO"),
                DbString(reader, "NUMEROENDERECO"),
                DbString(reader, "COMPLEMENTO"),
                DbString(reader, "BAIRRO"),
                DbString(reader, "CIDADE"),
                DbString(reader, "UF"),
                DbString(reader, "RG"),
                DbString(reader, "RGORGEMISSOR"),
                DbString(reader, "RGUF"),
                DbDateTime(reader, "RGDATAEMISSAO"),
                DbString(reader, "CARTEIRATRABALHO"),
                DbString(reader, "CARTEIRATRABALHOSERIE"),
                DbString(reader, "CARTEIRATRABALHOUF"),
                DbDateTime(reader, "CARTEIRATRABALHODATA"),
                DbString(reader, "NUMEROPIS"),
                DbString(reader, "TITULOELEITOR"),
                DbString(reader, "TITULOELEITORZONA"),
                DbString(reader, "TITULOELEITORSECAO"),
                DbString(reader, "CERTIFICADORESERVISTA"),
                DbString(reader, "CATEGORIAMILITAR"),
                DbString(reader, "NACIONALIDADE"),
                DbString(reader, "NOMEPAI"),
                DbString(reader, "NOMEMAE"),
                DbString(reader, "CODSECAO"),
                DbString(reader, "CENTROCUSTODESCRICAO"),
                DbString(reader, "CODFUNCAO"),
                DbString(reader, "FUNCAONOME"),
                DbString(reader, "CODIGOCARGO"),
                DbString(reader, "CARGONOME"),
                DbDecimal(reader, "SALARIOATUAL"),
                DbString(reader, "FILIALDESCRICAO"),
                DbString(reader, "GESTORDIRETONOME"),
                null));
        }

        return (funcionarios, totalItems);
    }

    private static async Task<List<LiveMovimentacaoRm>> LoadMovimentacoesRmLiveAsync(
        RmConnectionOptions options,
        IReadOnlyList<LiveFuncionarioRm> funcionarios,
        CancellationToken ct)
    {
        var chapas = funcionarios
            .Select(f => f.Chapa.Trim())
            .Where(chapa => !string.IsNullOrWhiteSpace(chapa))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var selectedKeys = funcionarios
            .Select(f => LiveEmployeeKey(f.CodColigada, f.Chapa))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var result = new List<LiveMovimentacaoRm>();
        if (chapas.Count == 0)
            return result;

        await using var conn = new SqlConnection(options.GetConnectionString());
        await conn.OpenAsync(ct);
        await LoadHistoricoSalarialLiveAsync(conn, chapas, selectedKeys, result, ct);
        await LoadTransfPromocaoLiveAsync(conn, chapas, selectedKeys, result, ct);
        await LoadDesligamentosLiveAsync(conn, chapas, selectedKeys, result, ct);
        return result;
    }

    private static async Task LoadHistoricoSalarialLiveAsync(
        SqlConnection conn,
        IReadOnlyList<string> chapas,
        IReadOnlySet<string> selectedKeys,
        List<LiveMovimentacaoRm> result,
        CancellationToken ct)
    {
        var rows = new List<HistoricoSalarialRmRow>();
        await QueryChapaBatchesAsync(conn, chapas, """
            SELECT
                CAST(CODCOLIGADA AS varchar(20)) AS CODCOLIGADA,
                NULLIF(LTRIM(RTRIM(CHAPA)), '') AS CHAPA,
                DTMUDANCA,
                NULLIF(LTRIM(RTRIM(MOTIVO)), '') AS MOTIVO,
                NROSALARIO,
                SALARIO,
                PERCENTAPLICADO
            FROM PFHSTSAL
            WHERE CHAPA IN ({0})
              AND DTMUDANCA IS NOT NULL
            ORDER BY CHAPA, DTMUDANCA, NROSALARIO;
            """, async reader =>
        {
            var chapa = DbString(reader, "CHAPA");
            if (string.IsNullOrWhiteSpace(chapa))
                return;
            rows.Add(new HistoricoSalarialRmRow(
                DbString(reader, "CODCOLIGADA"),
                chapa,
                DbDateTime(reader, "DTMUDANCA") ?? DateTime.UtcNow,
                DbString(reader, "MOTIVO"),
                DbInt(reader, "NROSALARIO"),
                DbDecimal(reader, "SALARIO"),
                DbDecimal(reader, "PERCENTAPLICADO")));
            await Task.CompletedTask;
        }, ct);

        var funcaoRows = new List<HistoricoFuncaoRmRow>();
        await QueryChapaBatchesAsync(conn, chapas, """
            SELECT
                CAST(H.CODCOLIGADA AS varchar(20)) AS CODCOLIGADA,
                NULLIF(LTRIM(RTRIM(H.CHAPA)), '') AS CHAPA,
                H.DTMUDANCA,
                NULLIF(LTRIM(RTRIM(H.CODFUNCAO)), '') AS CODFUNCAO,
                NULLIF(LTRIM(RTRIM(FU.NOME)), '') AS FUNCAONOME,
                NULLIF(LTRIM(RTRIM(FU.CARGO)), '') AS CODCARGO,
                NULLIF(LTRIM(RTRIM(C.NOME)), '') AS CARGONOME
            FROM PFHSTFCO H
            LEFT JOIN PFUNCAO FU
                ON FU.CODCOLIGADA = H.CODCOLIGADA
               AND FU.CODIGO = H.CODFUNCAO
            LEFT JOIN PCARGO C
                ON C.CODCOLIGADA = FU.CODCOLIGADA
               AND C.CODIGO = FU.CARGO
            WHERE H.CHAPA IN ({0})
              AND H.DTMUDANCA IS NOT NULL
            ORDER BY H.CHAPA, H.DTMUDANCA;
            """, async reader =>
        {
            var chapa = DbString(reader, "CHAPA");
            if (string.IsNullOrWhiteSpace(chapa))
                return;
            funcaoRows.Add(new HistoricoFuncaoRmRow(
                DbString(reader, "CODCOLIGADA"),
                chapa,
                DbDateTime(reader, "DTMUDANCA") ?? DateTime.UtcNow,
                DbString(reader, "CODFUNCAO"),
                DbString(reader, "FUNCAONOME"),
                DbString(reader, "CODCARGO"),
                DbString(reader, "CARGONOME")));
            await Task.CompletedTask;
        }, ct);

        var funcaoByEmployee = funcaoRows
            .Where(r => selectedKeys.Contains(LiveEmployeeKey(r.CodColigada, r.Chapa)))
            .GroupBy(r => LiveEmployeeKey(r.CodColigada, r.Chapa), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(r => r.DataMudanca).ToList(),
                StringComparer.OrdinalIgnoreCase);

        var gestorRows = new List<HistoricoGestorRmRow>();
        await QueryChapaBatchesAsync(conn, chapas, """
            SELECT
                CAST(H.CODCOLIGADAAVALIADO AS varchar(20)) AS CODCOLIGADA,
                NULLIF(LTRIM(RTRIM(H.CHAPAAVALIADO)), '') AS CHAPA,
                H.DATAACAO,
                CAST(H.CODCOLIGADAAVALIADOR AS varchar(20)) AS CODCOLIGADAGESTOR,
                NULLIF(LTRIM(RTRIM(H.CHAPAAVALIADOR)), '') AS CHAPAGESTOR,
                NULLIF(LTRIM(RTRIM(COALESCE(P.NOME, F.NOME))), '') AS NOMEGESTOR
            FROM VADHISTPARTICIPANTES H
            LEFT JOIN PFUNC F
                ON F.CODCOLIGADA = H.CODCOLIGADAAVALIADOR
               AND F.CHAPA = H.CHAPAAVALIADOR
            LEFT JOIN PPESSOA P
                ON P.CODIGO = F.CODPESSOA
            WHERE H.CHAPAAVALIADO IN ({0})
              AND H.DATAACAO IS NOT NULL
              AND H.CODTIPOAVALIADOR = 2
              AND H.CHAPAAVALIADOR IS NOT NULL
              AND H.CHAPAAVALIADOR <> H.CHAPAAVALIADO
            ORDER BY H.CHAPAAVALIADO, H.DATAACAO;
            """, async reader =>
        {
            var chapa = DbString(reader, "CHAPA");
            if (string.IsNullOrWhiteSpace(chapa))
                return;
            gestorRows.Add(new HistoricoGestorRmRow(
                DbString(reader, "CODCOLIGADA"),
                chapa,
                DbDateTime(reader, "DATAACAO") ?? DateTime.UtcNow,
                DbString(reader, "CODCOLIGADAGESTOR"),
                DbString(reader, "CHAPAGESTOR"),
                DbString(reader, "NOMEGESTOR")));
            await Task.CompletedTask;
        }, ct);

        var gestorByEmployee = gestorRows
            .Where(r => selectedKeys.Contains(LiveEmployeeKey(r.CodColigada, r.Chapa)))
            .GroupBy(r => LiveEmployeeKey(r.CodColigada, r.Chapa), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(r => r.DataAcao).ToList(),
                StringComparer.OrdinalIgnoreCase);

        static string? CargoDisplay(HistoricoFuncaoRmRow? row) =>
            FormatCodeDescription(row?.CodCargo, row?.CargoNome) ?? FormatCodeDescription(row?.CodFuncao, row?.FuncaoNome);

        static (HistoricoFuncaoRmRow? Origem, HistoricoFuncaoRmRow? Destino) ResolveHistoricoFuncao(
            IReadOnlyList<HistoricoFuncaoRmRow>? historico,
            DateTime dataMovimentacao)
        {
            if (historico is null || historico.Count == 0)
                return (null, null);

            var destinoIndex = -1;
            for (var i = 0; i < historico.Count; i++)
            {
                if (historico[i].DataMudanca <= dataMovimentacao)
                    destinoIndex = i;
                else
                    break;
            }

            if (destinoIndex < 0)
                destinoIndex = 0;

            var destino = historico[destinoIndex];
            var origem = destino.DataMudanca.Date == dataMovimentacao.Date && destinoIndex > 0
                ? historico[destinoIndex - 1]
                : destino;
            return (origem, destino);
        }

        static HistoricoGestorRmRow? ResolveHistoricoGestor(
            IReadOnlyList<HistoricoGestorRmRow>? historico,
            DateTime dataMovimentacao)
        {
            if (historico is null || historico.Count == 0)
                return null;

            HistoricoGestorRmRow? gestor = null;
            foreach (var row in historico)
            {
                if (row.DataAcao <= dataMovimentacao)
                    gestor = row;
                else
                    break;
            }

            return gestor;
        }

        foreach (var group in rows
            .Where(r => selectedKeys.Contains(LiveEmployeeKey(r.CodColigada, r.Chapa)))
            .GroupBy(r => LiveEmployeeKey(r.CodColigada, r.Chapa), StringComparer.OrdinalIgnoreCase))
        {
            decimal? prevSalario = null;
            var seqByKey = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            funcaoByEmployee.TryGetValue(group.Key, out var historicoFuncao);
            gestorByEmployee.TryGetValue(group.Key, out var historicoGestor);
            foreach (var row in group.OrderBy(r => r.DataMudanca).ThenBy(r => r.NroSalario ?? 0).ThenBy(r => r.Salario ?? 0))
            {
                var baseKey = $"{row.Chapa}-{row.DataMudanca:yyyyMMdd}-{row.NroSalario ?? 1}-{(row.Motivo ?? "").Trim()}";
                seqByKey.TryGetValue(baseKey, out var seq);
                seqByKey[baseKey] = seq + 1;
                var idReq = seq == 0 ? $"HSAL-{baseKey}" : $"HSAL-{baseKey}-{seq}";
                var (tipo, descricao) = MapHistoricoSalarialMotivo(row.Motivo);
                var (funcaoOrigem, funcaoDestino) = ResolveHistoricoFuncao(historicoFuncao, row.DataMudanca);
                var gestor = ResolveHistoricoGestor(historicoGestor, row.DataMudanca);
                result.Add(new LiveMovimentacaoRm(
                    row.CodColigada,
                    row.Chapa,
                    idReq,
                    tipo,
                    descricao,
                    row.DataMudanca,
                    row.DataMudanca,
                    4,
                    "Concluída",
                    funcaoOrigem?.CodFuncao,
                    funcaoDestino?.CodFuncao,
                    null,
                    null,
                    funcaoOrigem?.FuncaoNome,
                    funcaoDestino?.FuncaoNome,
                    CargoDisplay(funcaoOrigem),
                    CargoDisplay(funcaoDestino),
                    null,
                    null,
                    prevSalario,
                    row.Salario,
                    gestor?.ChapaGestor,
                    gestor?.NomeGestor,
                    row.PercentAplicado is decimal p && p != 0
                        ? $"Variação {p.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)}%"
                        : null,
                    null));
                prevSalario = row.Salario;
            }
        }
    }

    private static async Task LoadTransfPromocaoLiveAsync(
        SqlConnection conn,
        IReadOnlyList<string> chapas,
        IReadOnlySet<string> selectedKeys,
        List<LiveMovimentacaoRm> result,
        CancellationToken ct)
    {
        await QueryChapaBatchesAsync(conn, chapas, """
            SELECT
                CAST(R.CODCOLREQUISICAO AS varchar(20)) AS CODCOLIGADA,
                NULLIF(LTRIM(RTRIM(R.CHAPA)), '') AS CHAPA,
                R.IDREQ,
                NULLIF(LTRIM(RTRIM(R.CODMOTMUDFUNCAO)), '') AS CODMOTMUDFUNCAO,
                R.DATAABERTURA,
                R.DATACONCLUSAO,
                R.CODSTATUS,
                NULLIF(LTRIM(RTRIM(R.CODFUNCAOORG)), '') AS CODFUNCAOORG,
                NULLIF(LTRIM(RTRIM(R.CODFUNCAO)), '') AS CODFUNCAO,
                NULLIF(LTRIM(RTRIM(FO.NOME)), '') AS FUNCAOORIGEMNOME,
                NULLIF(LTRIM(RTRIM(FD.NOME)), '') AS FUNCAODESTINONOME,
                NULLIF(LTRIM(RTRIM(FO.CARGO)), '') AS CODCARGOORIGEM,
                NULLIF(LTRIM(RTRIM(CO.NOME)), '') AS CARGOORIGEMNOME,
                NULLIF(LTRIM(RTRIM(FD.CARGO)), '') AS CODCARGODESTINO,
                NULLIF(LTRIM(RTRIM(CD.NOME)), '') AS CARGODESTINONOME,
                NULLIF(LTRIM(RTRIM(R.CODSECAOORG)), '') AS CODSECAOORG,
                NULLIF(LTRIM(RTRIM(R.CODSECAO)), '') AS CODSECAO,
                NULLIF(LTRIM(RTRIM(SO.DESCRICAO)), '') AS SECAOORIGEMDESCRICAO,
                NULLIF(LTRIM(RTRIM(SD.DESCRICAO)), '') AS SECAODESTINODESCRICAO,
                R.VLRSALARIOORG,
                R.VLRSALARIO,
                NULLIF(LTRIM(RTRIM(R.CHAPAREQUISITANTE)), '') AS CHAPAREQUISITANTE,
                NULLIF(LTRIM(RTRIM(COALESCE(PREQ.NOME, FREQ.NOME))), '') AS NOMEREQUISITANTE,
                R.JUSTIFICATIVA
            FROM VREQTRANSFPROMOCAO R
            LEFT JOIN PFUNCAO FO
                ON FO.CODCOLIGADA = R.CODCOLREQUISICAO
               AND FO.CODIGO = R.CODFUNCAOORG
            LEFT JOIN PCARGO CO
                ON CO.CODCOLIGADA = FO.CODCOLIGADA
               AND CO.CODIGO = FO.CARGO
            LEFT JOIN PFUNCAO FD
                ON FD.CODCOLIGADA = R.CODCOLREQUISICAO
               AND FD.CODIGO = R.CODFUNCAO
            LEFT JOIN PCARGO CD
                ON CD.CODCOLIGADA = FD.CODCOLIGADA
               AND CD.CODIGO = FD.CARGO
            LEFT JOIN PSECAO SO
                ON SO.CODCOLIGADA = R.CODCOLREQUISICAO
               AND SO.CODIGO = R.CODSECAOORG
            LEFT JOIN PSECAO SD
                ON SD.CODCOLIGADA = R.CODCOLREQUISICAO
               AND SD.CODIGO = R.CODSECAO
            LEFT JOIN PFUNC FREQ
                ON FREQ.CODCOLIGADA = R.CODCOLREQUISITANTE
               AND FREQ.CHAPA = R.CHAPAREQUISITANTE
            LEFT JOIN PPESSOA PREQ
                ON PREQ.CODIGO = FREQ.CODPESSOA
            WHERE R.CHAPA IN ({0})
              AND R.IDREQ IS NOT NULL;
            """, async reader =>
        {
            var codColigada = DbString(reader, "CODCOLIGADA");
            var chapa = DbString(reader, "CHAPA");
            if (string.IsNullOrWhiteSpace(chapa) || !selectedKeys.Contains(LiveEmployeeKey(codColigada, chapa)))
                return;

            var (tipo, descricao) = MapTransfPromocaoMotivo(DbString(reader, "CODMOTMUDFUNCAO"));
            result.Add(new LiveMovimentacaoRm(
                codColigada,
                chapa,
                DbString(reader, "IDREQ") ?? "",
                tipo,
                descricao,
                DbDateTime(reader, "DATAABERTURA") ?? DateTime.UtcNow,
                DbDateTime(reader, "DATACONCLUSAO"),
                DbInt(reader, "CODSTATUS") ?? 0,
                MapStatus(DbInt(reader, "CODSTATUS")),
                DbString(reader, "CODFUNCAOORG"),
                DbString(reader, "CODFUNCAO"),
                DbString(reader, "CODSECAOORG"),
                DbString(reader, "CODSECAO"),
                DbString(reader, "FUNCAOORIGEMNOME"),
                DbString(reader, "FUNCAODESTINONOME"),
                FormatCodeDescription(DbString(reader, "CODCARGOORIGEM"), DbString(reader, "CARGOORIGEMNOME")),
                FormatCodeDescription(DbString(reader, "CODCARGODESTINO"), DbString(reader, "CARGODESTINONOME")),
                DbString(reader, "SECAOORIGEMDESCRICAO"),
                DbString(reader, "SECAODESTINODESCRICAO"),
                DbDecimal(reader, "VLRSALARIOORG"),
                DbDecimal(reader, "VLRSALARIO"),
                DbString(reader, "CHAPAREQUISITANTE"),
                DbString(reader, "NOMEREQUISITANTE"),
                DbString(reader, "JUSTIFICATIVA"),
                null));
            await Task.CompletedTask;
        }, ct);
    }

    private static async Task LoadDesligamentosLiveAsync(
        SqlConnection conn,
        IReadOnlyList<string> chapas,
        IReadOnlySet<string> selectedKeys,
        List<LiveMovimentacaoRm> result,
        CancellationToken ct)
    {
        await QueryChapaBatchesAsync(conn, chapas, """
            SELECT
                CAST(R.CODCOLREQUISICAO AS varchar(20)) AS CODCOLIGADA,
                NULLIF(LTRIM(RTRIM(R.CHAPA)), '') AS CHAPA,
                R.IDREQ,
                R.DATAABERTURA,
                R.DATACONCLUSAO,
                R.CODSTATUS,
                R.CRIASUBSTITUICAO,
                NULLIF(LTRIM(RTRIM(R.CHAPAREQUISITANTE)), '') AS CHAPAREQUISITANTE,
                NULLIF(LTRIM(RTRIM(COALESCE(PREQ.NOME, FREQ.NOME))), '') AS NOMEREQUISITANTE,
                R.JUSTIFICATIVA
            FROM VREQDESLIGAMENTO R
            LEFT JOIN PFUNC FREQ
                ON FREQ.CODCOLIGADA = R.CODCOLREQUISITANTE
               AND FREQ.CHAPA = R.CHAPAREQUISITANTE
            LEFT JOIN PPESSOA PREQ
                ON PREQ.CODIGO = FREQ.CODPESSOA
            WHERE R.CHAPA IN ({0})
              AND R.IDREQ IS NOT NULL;
            """, async reader =>
        {
            var codColigada = DbString(reader, "CODCOLIGADA");
            var chapa = DbString(reader, "CHAPA");
            if (string.IsNullOrWhiteSpace(chapa) || !selectedKeys.Contains(LiveEmployeeKey(codColigada, chapa)))
                return;

            result.Add(new LiveMovimentacaoRm(
                codColigada,
                chapa,
                $"DESL-{DbString(reader, "IDREQ")}",
                5,
                "Desligamento",
                DbDateTime(reader, "DATAABERTURA") ?? DateTime.UtcNow,
                DbDateTime(reader, "DATACONCLUSAO"),
                DbInt(reader, "CODSTATUS") ?? 0,
                MapStatus(DbInt(reader, "CODSTATUS")),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                DbString(reader, "CHAPAREQUISITANTE"),
                DbString(reader, "NOMEREQUISITANTE"),
                DbString(reader, "JUSTIFICATIVA"),
                (DbInt(reader, "CRIASUBSTITUICAO") ?? 0) == 1));
            await Task.CompletedTask;
        }, ct);
    }

    private static async Task QueryChapaBatchesAsync(
        SqlConnection conn,
        IReadOnlyList<string> chapas,
        string sqlTemplate,
        Func<SqlDataReader, Task> handleRow,
        CancellationToken ct)
    {
        const int batchSize = 900;
        for (var offset = 0; offset < chapas.Count; offset += batchSize)
        {
            var batch = chapas.Skip(offset).Take(batchSize).ToList();
            var parameters = batch.Select((_, index) => $"@p{index}").ToList();
            await using var cmd = new SqlCommand(string.Format(System.Globalization.CultureInfo.InvariantCulture, sqlTemplate, string.Join(", ", parameters)), conn);
            for (var i = 0; i < batch.Count; i++)
                cmd.Parameters.AddWithValue($"@p{i}", batch[i]);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                await handleRow(reader);
        }
    }

    private static string LiveEmployeeKey(string? codColigada, string? chapa) =>
        $"{NormalizeRmCode(codColigada)}|{chapa?.Trim() ?? ""}";

    private static string NormalizeRmCode(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return "";
        return int.TryParse(trimmed, out var numeric)
            ? numeric.ToString(System.Globalization.CultureInfo.InvariantCulture)
            : trimmed;
    }

    private static DateTime LiveMovementDate(LiveMovimentacaoRm mov) =>
        mov.DataConclusao ?? mov.DataAbertura;

    private static string? FormatCodeDescription(string? code, string? description)
    {
        var trimmedCode = code?.Trim();
        var trimmedDescription = description?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedCode)) return string.IsNullOrWhiteSpace(trimmedDescription) ? null : trimmedDescription;
        if (string.IsNullOrWhiteSpace(trimmedDescription)) return trimmedCode;
        return $"{trimmedCode} - {trimmedDescription}";
    }

    private static string? FormatTwoDigitCodeDescription(string? code, string? description)
    {
        var trimmedCode = code?.Trim();
        if (!string.IsNullOrWhiteSpace(trimmedCode) && int.TryParse(trimmedCode, out var numeric))
            trimmedCode = numeric.ToString("00", System.Globalization.CultureInfo.InvariantCulture);
        return FormatCodeDescription(trimmedCode, description);
    }

    private static string SituacaoRmDescricao(string? code) => code?.Trim().ToUpperInvariant() switch
    {
        "A" => "Ativo",
        "F" => "Férias",
        "P" => "Pré-admissão",
        "D" => "Demitido",
        "I" => "Inativo",
        "T" => "Transferido",
        "R" => "Aposentado",
        "B" => "Beneficiário",
        "S" => "Substituição",
        "Z" => "Outros (Z)",
        "W" => "Outros (W)",
        "M" => "Outros (M)",
        null or "" => "Não informado",
        var value => $"Código {value}"
    };

    private static bool IsRmActiveStatus(string? code) =>
        code?.Trim().ToUpperInvariant() is "A" or "F" or "P";

    private static string MapStatus(int? codStatus) => codStatus switch
    {
        1 => "Aberta",
        2 => "Em análise",
        3 => "Aprovada",
        4 => "Concluída",
        5 => "Em andamento",
        6 => "Cancelada",
        7 => "Rejeitada",
        null => "Status não informado",
        _ => $"Status {codStatus}"
    };

    private static (short Tipo, string Descricao) MapTransfPromocaoMotivo(string? motivo)
    {
        var code = motivo?.Trim();
        return code switch
        {
            "05" or "5" => ((short)1, "Promoção"),
            "01" or "1" => ((short)3, "Mudança de função"),
            _ => ((short)2, "Transferência"),
        };
    }

    private static string? DbString(SqlDataReader reader, string name)
    {
        var value = reader[name];
        return value is DBNull ? null : value.ToString()?.Trim();
    }

    private static DateTime? DbDateTime(SqlDataReader reader, string name)
    {
        var value = reader[name];
        return value is DBNull ? null : Convert.ToDateTime(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static decimal? DbDecimal(SqlDataReader reader, string name)
    {
        var value = reader[name];
        return value is DBNull ? null : Convert.ToDecimal(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static int? DbInt(SqlDataReader reader, string name)
    {
        var value = reader[name];
        return value is DBNull ? null : Convert.ToInt32(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private sealed record LiveFuncionarioRm(
        string? CodColigada,
        string Chapa,
        string? EmpresaDescricao,
        string? CodFilial,
        string? CodSituacao,
        string SituacaoDescricao,
        string StatusPortal,
        DateTime? DataAdmissao,
        string? Nome,
        string? Email,
        string? Telefone,
        string? Cpf,
        DateTime? DataNascimento,
        string? Sexo,
        string? EstadoCivil,
        string? GrauInstrucao,
        string? Naturalidade,
        string? EstadoNatal,
        string? Cep,
        string? Logradouro,
        string? NumeroEndereco,
        string? Complemento,
        string? Bairro,
        string? Cidade,
        string? Uf,
        string? Rg,
        string? RgOrgEmissor,
        string? RgUf,
        DateTime? RgDataEmissao,
        string? CarteiraTrabalho,
        string? CarteiraTrabalhoSerie,
        string? CarteiraTrabalhoUf,
        DateTime? CarteiraTrabalhoData,
        string? NumeroPis,
        string? TituloEleitor,
        string? TituloEleitorZona,
        string? TituloEleitorSecao,
        string? CertificadoReservista,
        string? CategoriaMilitar,
        string? Nacionalidade,
        string? NomePai,
        string? NomeMae,
        string? CodSecao,
        string? CentroCustoDescricao,
        string? CodFuncao,
        string? FuncaoNome,
        string? CodigoCargo,
        string? CargoNome,
        decimal? SalarioAtual,
        string? FilialDescricao,
        string? GestorDiretoNome,
        string? HierarquiaDescricao);

    private sealed record LiveMovimentacaoRm(
        string? CodColigada,
        string Chapa,
        string IdReqRm,
        short TipoMovimentacao,
        string TipoDescricao,
        DateTime DataAbertura,
        DateTime? DataConclusao,
        int CodStatus,
        string StatusDescricao,
        string? CodFuncaoOrigem,
        string? CodFuncaoDestino,
        string? CodSecaoOrigem,
        string? CodSecaoDestino,
        string? FuncaoOrigemNome,
        string? FuncaoDestinoNome,
        string? CargoOrigem,
        string? CargoDestino,
        string? SecaoOrigemDescricao,
        string? SecaoDestinoDescricao,
        decimal? SalarioOrigem,
        decimal? SalarioDestino,
        string? GestorHistoricoChapaRm,
        string? GestorHistoricoNome,
        string? Justificativa,
        bool? GerouSubstituicao);

    private static async Task<Dictionary<string, (string? Chapa, string? Nome)>> LoadGestoresHistoricosFromRmAsync(
        RmConnectionOptions options,
        IReadOnlyList<FuncionarioMovimentacao> movimentacoes,
        CancellationToken ct)
    {
        var transfIds = movimentacoes
            .Where(m => m.TipoMovimentacao != 5 && !string.IsNullOrWhiteSpace(m.IdReqRm) && !m.IdReqRm.StartsWith("DESL-", StringComparison.OrdinalIgnoreCase))
            .Select(m => m.IdReqRm.Trim())
            .Where(id => int.TryParse(id, out _))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var desligamentoIds = movimentacoes
            .Where(m => m.TipoMovimentacao == 5 || m.IdReqRm.StartsWith("DESL-", StringComparison.OrdinalIgnoreCase))
            .Select(m => m.IdReqRm.StartsWith("DESL-", StringComparison.OrdinalIgnoreCase) ? m.IdReqRm[5..] : m.IdReqRm)
            .Where(id => int.TryParse(id, out _))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var result = new Dictionary<string, (string? Chapa, string? Nome)>(StringComparer.OrdinalIgnoreCase);
        if (transfIds.Count == 0 && desligamentoIds.Count == 0)
            return result;

        await using var conn = new SqlConnection(options.GetConnectionString());
        await conn.OpenAsync(ct);

        async Task QueryAsync(string tableName, IReadOnlyList<string> ids, string keyPrefix)
        {
            const int batchSize = 900;
            for (var offset = 0; offset < ids.Count; offset += batchSize)
            {
                var batch = ids.Skip(offset).Take(batchSize).ToList();
                var parameters = batch.Select((_, index) => $"@p{index}").ToList();
                var sql = $"""
                    SELECT
                        CONCAT(@KeyPrefix, CAST(R.IDREQ AS varchar(40))) AS ReportKey,
                        NULLIF(LTRIM(RTRIM(R.CHAPAREQUISITANTE)), '') AS ChapaRequisitante,
                        NULLIF(LTRIM(RTRIM(COALESCE(P.NOME, FREQ.NOME))), '') AS NomeRequisitante
                    FROM {tableName} R
                    LEFT JOIN PFUNC FREQ
                        ON FREQ.CODCOLIGADA = R.CODCOLREQUISITANTE
                       AND FREQ.CHAPA = R.CHAPAREQUISITANTE
                    LEFT JOIN PPESSOA P
                        ON P.CODIGO = FREQ.CODPESSOA
                    WHERE R.IDREQ IN ({string.Join(", ", parameters)});
                    """;

                await using var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@KeyPrefix", keyPrefix);
                for (var i = 0; i < batch.Count; i++)
                    cmd.Parameters.AddWithValue($"@p{i}", int.Parse(batch[i], System.Globalization.CultureInfo.InvariantCulture));

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    var key = reader["ReportKey"]?.ToString();
                    if (string.IsNullOrWhiteSpace(key)) continue;
                    var chapa = reader["ChapaRequisitante"]?.ToString();
                    var nome = reader["NomeRequisitante"]?.ToString();
                    result[key] = (string.IsNullOrWhiteSpace(chapa) ? null : chapa.Trim(), string.IsNullOrWhiteSpace(nome) ? null : nome.Trim());
                }
            }
        }

        await QueryAsync("VREQTRANSFPROMOCAO", transfIds, "");
        await QueryAsync("VREQDESLIGAMENTO", desligamentoIds, "DESL-");

        return result;
    }

    private static async Task<Dictionary<Guid, decimal>> LoadSalariosAtuaisFromRmAsync(
        RmConnectionOptions options,
        IReadOnlyList<Funcionario> funcionarios,
        CancellationToken ct)
    {
        var chapas = funcionarios
            .Select(f => f.MatriculaRm?.Trim())
            .Where(chapa => !string.IsNullOrWhiteSpace(chapa))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var result = new Dictionary<Guid, decimal>();
        if (chapas.Count == 0)
            return result;

        static string NormalizeColigada(string? value)
        {
            var trimmed = value?.Trim();
            if (string.IsNullOrWhiteSpace(trimmed)) return "";
            return int.TryParse(trimmed, out var numeric)
                ? numeric.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : trimmed;
        }

        static string SalaryKey(string? coligada, string? chapa) =>
            $"{NormalizeColigada(coligada)}|{chapa?.Trim() ?? ""}";

        var salarioByColigadaChapa = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var salarioByChapa = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        await using var conn = new SqlConnection(options.GetConnectionString());
        await conn.OpenAsync(ct);

        const int batchSize = 900;
        for (var offset = 0; offset < chapas.Count; offset += batchSize)
        {
            var batch = chapas.Skip(offset).Take(batchSize).ToList();
            var parameters = batch.Select((_, index) => $"@p{index}").ToList();
            var sql = $"""
                SELECT
                    CAST(CODCOLIGADA AS varchar(20)) AS CODCOLIGADA,
                    NULLIF(LTRIM(RTRIM(CHAPA)), '') AS CHAPA,
                    SALARIO
                FROM PFUNC
                WHERE CHAPA IN ({string.Join(", ", parameters)})
                  AND SALARIO IS NOT NULL;
                """;

            await using var cmd = new SqlCommand(sql, conn);
            for (var i = 0; i < batch.Count; i++)
                cmd.Parameters.AddWithValue($"@p{i}", batch[i]!);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var coligada = reader["CODCOLIGADA"]?.ToString();
                var chapa = reader["CHAPA"]?.ToString();
                if (string.IsNullOrWhiteSpace(chapa) || reader["SALARIO"] is DBNull)
                    continue;

                var salario = Convert.ToDecimal(reader["SALARIO"], System.Globalization.CultureInfo.InvariantCulture);
                salarioByColigadaChapa[SalaryKey(coligada, chapa)] = salario;
                salarioByChapa.TryAdd(chapa.Trim(), salario);
            }
        }

        foreach (var funcionario in funcionarios)
        {
            var chapa = funcionario.MatriculaRm?.Trim();
            if (string.IsNullOrWhiteSpace(chapa))
                continue;

            if (salarioByColigadaChapa.TryGetValue(SalaryKey(funcionario.CdnEmpresa, chapa), out var salario)
                || salarioByChapa.TryGetValue(chapa, out salario))
            {
                result[funcionario.Id] = salario;
            }
        }

        return result;
    }

    private static async Task<List<FuncionarioMovimentacao>> LoadHistoricoSalarialFromRmAsync(
        RmConnectionOptions options,
        IReadOnlyList<Funcionario> funcionarios,
        IReadOnlyList<FuncionarioMovimentacao> movimentacoesExistentes,
        CancellationToken ct)
    {
        var chapas = funcionarios
            .Select(f => f.MatriculaRm?.Trim())
            .Where(chapa => !string.IsNullOrWhiteSpace(chapa))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (chapas.Count == 0)
            return [];

        static string NormalizeColigada(string? value)
        {
            var trimmed = value?.Trim();
            if (string.IsNullOrWhiteSpace(trimmed)) return "";
            return int.TryParse(trimmed, out var numeric)
                ? numeric.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : trimmed;
        }

        static string EmployeeKey(string? coligada, string? chapa) =>
            $"{NormalizeColigada(coligada)}|{chapa?.Trim() ?? ""}";

        var funcionarioByColigadaChapa = funcionarios
            .Where(f => !string.IsNullOrWhiteSpace(f.MatriculaRm))
            .GroupBy(f => EmployeeKey(f.CdnEmpresa, f.MatriculaRm), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var funcionarioByChapa = funcionarios
            .Where(f => !string.IsNullOrWhiteSpace(f.MatriculaRm))
            .GroupBy(f => f.MatriculaRm!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var existingIds = movimentacoesExistentes
            .Select(m => m.IdReqRm)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rows = new List<HistoricoSalarialRmRow>();

        await using var conn = new SqlConnection(options.GetConnectionString());
        await conn.OpenAsync(ct);

        const int batchSize = 900;
        for (var offset = 0; offset < chapas.Count; offset += batchSize)
        {
            var batch = chapas.Skip(offset).Take(batchSize).ToList();
            var parameters = batch.Select((_, index) => $"@p{index}").ToList();
            var sql = $"""
                SELECT
                    CAST(CODCOLIGADA AS varchar(20)) AS CODCOLIGADA,
                    NULLIF(LTRIM(RTRIM(CHAPA)), '') AS CHAPA,
                    DTMUDANCA,
                    NULLIF(LTRIM(RTRIM(MOTIVO)), '') AS MOTIVO,
                    NROSALARIO,
                    SALARIO,
                    PERCENTAPLICADO
                FROM PFHSTSAL
                WHERE CHAPA IN ({string.Join(", ", parameters)})
                  AND DTMUDANCA IS NOT NULL
                ORDER BY CHAPA, DTMUDANCA, NROSALARIO;
                """;

            await using var cmd = new SqlCommand(sql, conn);
            for (var i = 0; i < batch.Count; i++)
                cmd.Parameters.AddWithValue($"@p{i}", batch[i]!);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var chapa = reader["CHAPA"]?.ToString();
                if (string.IsNullOrWhiteSpace(chapa))
                    continue;

                rows.Add(new HistoricoSalarialRmRow(
                    reader["CODCOLIGADA"]?.ToString(),
                    chapa.Trim(),
                    Convert.ToDateTime(reader["DTMUDANCA"], System.Globalization.CultureInfo.InvariantCulture),
                    reader["MOTIVO"]?.ToString(),
                    reader["NROSALARIO"] is DBNull ? null : Convert.ToInt32(reader["NROSALARIO"], System.Globalization.CultureInfo.InvariantCulture),
                    reader["SALARIO"] is DBNull ? null : Convert.ToDecimal(reader["SALARIO"], System.Globalization.CultureInfo.InvariantCulture),
                    reader["PERCENTAPLICADO"] is DBNull ? null : Convert.ToDecimal(reader["PERCENTAPLICADO"], System.Globalization.CultureInfo.InvariantCulture)));
            }
        }

        var result = new List<FuncionarioMovimentacao>();
        foreach (var group in rows
            .GroupBy(r => EmployeeKey(r.CodColigada, r.Chapa), StringComparer.OrdinalIgnoreCase)
            .OrderBy(g => g.Key))
        {
            if (!funcionarioByColigadaChapa.TryGetValue(group.Key, out var funcionario)
                && !funcionarioByChapa.TryGetValue(group.First().Chapa, out funcionario))
            {
                continue;
            }

            decimal? prevSalario = null;
            var seqByKey = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in group.OrderBy(r => r.DataMudanca).ThenBy(r => r.NroSalario ?? 0).ThenBy(r => r.Salario ?? 0))
            {
                var baseKey = $"{row.Chapa}-{row.DataMudanca:yyyyMMdd}-{row.NroSalario ?? 1}-{(row.Motivo ?? "").Trim()}";
                seqByKey.TryGetValue(baseKey, out var seq);
                seqByKey[baseKey] = seq + 1;
                var idReq = seq == 0 ? $"HSAL-{baseKey}" : $"HSAL-{baseKey}-{seq}";
                if (existingIds.Contains(idReq))
                {
                    prevSalario = row.Salario;
                    continue;
                }

                var (tipo, descricao) = MapHistoricoSalarialMotivo(row.Motivo);
                result.Add(new FuncionarioMovimentacao
                {
                    Id = Guid.NewGuid(),
                    FuncionarioId = funcionario.Id,
                    ChapaRm = row.Chapa,
                    IdReqRm = idReq,
                    TipoMovimentacao = tipo,
                    TipoDescricao = descricao,
                    DataAbertura = DateTime.SpecifyKind(row.DataMudanca, DateTimeKind.Utc),
                    DataConclusao = DateTime.SpecifyKind(row.DataMudanca, DateTimeKind.Utc),
                    CodStatus = 4,
                    StatusDescricao = "Concluída",
                    SalarioOrigem = prevSalario,
                    SalarioDestino = row.Salario,
                    Justificativa = row.PercentAplicado is decimal p && p != 0
                        ? $"Variação {p.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)}%"
                        : null,
                    UpdatedAtUtc = DateTimeOffset.UtcNow,
                });
                prevSalario = row.Salario;
            }
        }

        return result;
    }

    private static (short Tipo, string Descricao) MapHistoricoSalarialMotivo(string? motivo)
    {
        var code = (motivo ?? "").Trim();
        return code switch
        {
            "00" or "01" => ((short)11, "Admissão"),
            "05" => ((short)1, "Promoção"),
            "12" => ((short)4, "Enquadramento Salarial"),
            "20" => ((short)4, "Plano de Cargos e Salários"),
            "21" => ((short)4, "Acordo Coletivo"),
            "02" => ((short)4, "Mérito"),
            "03" => ((short)4, "Reajuste"),
            "04" => ((short)4, "Aumento de Função"),
            "06" => ((short)4, "Equiparação Salarial"),
            "07" => ((short)4, "Reclassificação"),
            "08" => ((short)4, "Cláusula Coletiva"),
            "09" => ((short)4, "Antecipação"),
            "11" => ((short)4, "Reenquadramento"),
            "13" => ((short)4, "Ajuste de Faixa"),
            "15" => ((short)4, "Aumento Espontâneo"),
            "16" => ((short)4, "Avaliação"),
            "17" => ((short)4, "Mudança de Função"),
            "18" => ((short)4, "Transferência Salarial"),
            "19" => ((short)4, "Tabela Salarial"),
            "" => ((short)4, "Mudança Salarial"),
            _ => ((short)4, $"Mudança Salarial (motivo {code})"),
        };
    }

    private sealed record HistoricoSalarialRmRow(
        string? CodColigada,
        string Chapa,
        DateTime DataMudanca,
        string? Motivo,
        int? NroSalario,
        decimal? Salario,
        decimal? PercentAplicado);

    private sealed record HistoricoFuncaoRmRow(
        string? CodColigada,
        string Chapa,
        DateTime DataMudanca,
        string? CodFuncao,
        string? FuncaoNome,
        string? CodCargo,
        string? CargoNome);

    private sealed record HistoricoGestorRmRow(
        string? CodColigada,
        string Chapa,
        DateTime DataAcao,
        string? CodColigadaGestor,
        string? ChapaGestor,
        string? NomeGestor);

    private static readonly IReadOnlyList<FuncionarioRmReportColumnResponse> FuncionarioRmReportColumns =
    [
        new("cdnEmpresa", "Empresa", "Código e descrição da coligada/empresa, no formato código - descrição."),
        new("cdnEstab", "Estab.", "Código e descrição do estabelecimento/filial, no formato código - descrição."),
        new("matriculaRm", "Matrícula RM", "CHAPA original do funcionário no TOTVS RM. A matrícula do Portal é uma normalização desse mesmo valor, por isso fica omitida no relatório."),
        new("nome", "Nome", "Nome do colaborador vindo de PPESSOA.NOME, via PFUNC.CODPESSOA."),
        new("email", "E-mail", "E-mail cadastral vindo de PPESSOA.EMAIL, quando informado."),
        new("telefone", "Telefone", "Telefone principal vindo de PPESSOA.TELEFONE1."),
        new("statusPortal", "Status Portal", "Status simplificado usado pelo Portal: Active para A/F/P, Inactive para os demais códigos."),
        new("codSituacaoRm", "Situação RM", "Código e descrição da situação do funcionário no RM, no formato código - descrição."),
        new("dataAdmissao", "Data admissão", "Data oficial de admissão vinda de PFUNC.DATAADMISSAO."),
        new("dataNascimento", "Data nascimento", "Data de nascimento importada de PPESSOA.DTNASCIMENTO."),
        new("sexo", "Sexo", "Código de sexo vindo de PPESSOA.SEXO."),
        new("cpf", "CPF", "CPF vindo de PPESSOA.CPF; usado para vincular Pessoa no Portal."),
        new("estadoCivil", "Estado civil", "Código e descrição do estado civil, no formato código - descrição."),
        new("grauInstrucao", "Grau instrução", "Código de escolaridade vindo de PPESSOA.GRAUINSTRUCAO."),
        new("naturalidade", "Naturalidade", "Cidade de nascimento vinda de PPESSOA.NATURALIDADE."),
        new("estadoNatal", "UF nascimento", "UF de nascimento vinda de PPESSOA.ESTADONATAL."),
        new("cep", "CEP", "CEP residencial vindo de PPESSOA.CEP."),
        new("logradouro", "Logradouro", "Rua/endereço vindo de PPESSOA.RUA."),
        new("numeroEndereco", "Número", "Número do endereço vindo de PPESSOA.NUMERO."),
        new("complemento", "Complemento", "Complemento de endereço vindo de PPESSOA.COMPLEMENTO."),
        new("bairro", "Bairro", "Bairro vindo de PPESSOA.BAIRRO."),
        new("cidade", "Cidade", "Cidade residencial vinda de PPESSOA.CIDADE."),
        new("uf", "UF", "UF residencial vinda de PPESSOA.ESTADO."),
        new("rg", "RG", "Documento de identidade vindo de PPESSOA.CARTIDENTIDADE."),
        new("rgOrgEmissor", "Órgão RG", "Órgão emissor do RG vindo de PPESSOA.ORGEMISSORIDENT."),
        new("rgUf", "UF RG", "UF do RG vinda de PPESSOA.UFCARTIDENT."),
        new("rgDataEmissao", "Emissão RG", "Data de emissão do RG vinda de PPESSOA.DTEMISSAOIDENT."),
        new("carteiraTrabalho", "CTPS", "Número da carteira de trabalho vindo de PPESSOA.CARTEIRATRAB."),
        new("carteiraTrabalhoSerie", "Série CTPS", "Série da carteira de trabalho vinda de PPESSOA.SERIECARTTRAB."),
        new("carteiraTrabalhoUf", "UF CTPS", "UF da carteira de trabalho vinda de PPESSOA.UFCARTTRAB."),
        new("carteiraTrabalhoData", "Emissão CTPS", "Data da carteira de trabalho vinda de PPESSOA.DTCARTTRAB."),
        new("numeroPis", "PIS/PASEP", "Número PIS/PASEP/NIS vindo de PPESSOA.NIT."),
        new("tituloEleitor", "Título eleitor", "Título de eleitor vindo de PPESSOA.TITULOELEITOR."),
        new("tituloEleitorZona", "Zona título", "Zona eleitoral vinda de PPESSOA.ZONATITELEITOR."),
        new("tituloEleitorSecao", "Seção título", "Seção eleitoral vinda de PPESSOA.SECAOTITELEITOR."),
        new("certificadoReservista", "Reservista", "Certificado de reservista vindo de PPESSOA.CERTIFRESERV."),
        new("categoriaMilitar", "Categoria militar", "Categoria militar vinda de PPESSOA.CATEGMILITAR."),
        new("nacionalidade", "Nacionalidade", "Código e descrição da nacionalidade, no formato código - descrição. Código 10 = Brasileira."),
        new("nomePai", "Nome do pai", "Filiação paterna buscada no RM por XPESSOAFISICA, SPESSOA ou cadastros de candidato, quando disponível."),
        new("nomeMae", "Nome da mãe", "Filiação materna buscada no RM por XPESSOAFISICA, SPESSOA ou cadastros de candidato, quando disponível."),
        new("centroCustoCode", "Centro de custo", "Código e descrição do centro de custo/seção, no formato código - descrição."),
        new("jobPositionCode", "Cargo", "Código e nome do cargo no Portal, no formato código - descrição."),
        new("codFuncaoRm", "Função RM", "Código e nome da função específica do RM, no formato código - descrição."),
        new("salarioAtual", "Salário atual", "Salário atual lido diretamente do RM em PFUNC.SALARIO; quando não houver retorno do RM, usa a movimentação mais recente com salário destino."),
        new("unitName", "Filial", "Filial/estabelecimento resolvido a partir de PFUNC.CODFILIAL/GFILIAL."),
        new("gestorDiretoNome", "Gestor direto", "Gestor direto resolvido por hierarquia de posição ou fallbacks do RM."),
        new("nivelHierarquicoNome", "Nível", "Nível hierárquico/cargo resolvido no Portal."),
        new("hierarquiaDescricao", "Hierarquia RM", "Nó do organograma RM associado ao funcionário."),
        new("hasIncompleteData", "Dados incompletos", "Indica se o Portal detectou campos obrigatórios não resolvidos."),
        new("updatedAtUtc", "Atualizado em", "Última atualização do registro no Portal.")
    ];

    private static readonly IReadOnlyList<FuncionarioRmReportColumnResponse> FuncionarioRmReportMovimentacaoColumns =
    [
        new("movimentacaoIdReqRm", "Mov. ID RM", "Identificador da requisição/movimentação no RM ou ID sintético do histórico salarial."),
        new("movimentacaoTipoCodigo", "Movimentação", "Descrição do tipo de movimentação: Promoção, Transferência, Mudança de função, Aumento salarial, Desligamento, Aumento de quadro, Substituição ou Admissão."),
        new("movimentacaoDataAbertura", "Mov. abertura", "Data de abertura ou data de mudança da movimentação no RM."),
        new("movimentacaoDataConclusao", "Mov. conclusão", "Data de conclusão da movimentação, quando informada pelo RM."),
        new("movimentacaoCodStatus", "Mov. status", "Código e descrição do status da movimentação, no formato código - descrição."),
        new("movimentacaoCodFuncaoOrigem", "Função origem", "Código e nome da função antes da movimentação, no formato código - descrição."),
        new("movimentacaoCodFuncaoDestino", "Função destino", "Código e nome da função após a movimentação, no formato código - descrição."),
        new("movimentacaoCodSecaoOrigem", "Seção origem", "Código e descrição da seção antes da movimentação, no formato código - descrição."),
        new("movimentacaoCodSecaoDestino", "Seção destino", "Código e descrição da seção após a movimentação, no formato código - descrição."),
        new("movimentacaoGerouSubstituicao", "Gerou substituição", "Indica se a movimentação de desligamento gerou substituição."),
        new("movimentacaoSalarioOrigem", "Salário origem", "Salário antes da movimentação, quando informado no histórico RM."),
        new("movimentacaoSalarioDestino", "Salário destino", "Salário após a movimentação, quando informado no histórico RM."),
        new("movimentacaoPeriodoInicio", "Período início", "Data usada como início do período na função/cargo após a movimentação."),
        new("movimentacaoPeriodoFim", "Período fim", "Próxima movimentação do funcionário ou data atual para a movimentação mais recente; desligamento usa a própria data do evento."),
        new("movimentacaoTempoFuncaoDias", "Tempo função dias", "Quantidade de dias calculada entre o início e o fim do período da função/cargo."),
        new("movimentacaoTempoFuncao", "Tempo função", "Tempo calculado em anos, meses e dias para facilitar leitura."),
        new("movimentacaoSalarioAnterior", "Salário anterior calc.", "Salário usado como base de comparação: salário origem da movimentação ou último salário destino conhecido."),
        new("movimentacaoDiferencaSalarioAnterior", "Dif. salário", "Diferença calculada entre salário destino e salário anterior."),
        new("movimentacaoPercentualSalarioAnterior", "% salário", "Percentual calculado da diferença salarial em relação ao salário anterior."),
        new("movimentacaoGestorHistoricoChapaRm", "Gestor hist.", "CHAPA e nome do gestor/requisitante histórico informado na requisição RM, no formato código - descrição."),
        new("movimentacaoJustificativa", "Mov. justificativa", "Justificativa observada na movimentação ou descrição complementar do histórico salarial.")
    ];

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
