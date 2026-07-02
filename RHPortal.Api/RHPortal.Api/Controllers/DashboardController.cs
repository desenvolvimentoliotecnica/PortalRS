using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using RhPortal.Api.Application.Dashboard;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Contracts.Dashboard;
using RhPortal.Api.Contracts.Schedule;
using RhPortal.Api.Domain;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using System.Globalization;
using System.Text;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Dados do dashboard (visão rápida de RH).
/// </summary>
[ApiController]
[Route("api/dashboard")]
[Authorize]
public sealed class DashboardController(ILogger<DashboardController> logger) : ControllerBase
{
    /// <summary>
    /// Indicadores principais do dashboard (vagas abertas, candidatos do dia, pendentes e aprovados).
    /// </summary>
    [HttpGet("kpis")]
    [ProducesResponseType(typeof(DashboardKpisResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardKpisResponse>> GetKpis(
        [FromServices] AppDbContext db,
        [FromServices] IOptions<SlaVagaOptions> slaOptions,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var todayStart = new DateTimeOffset(now.Date, TimeSpan.Zero);
        var weekStart = now.AddDays(-7);
        var opts = slaOptions.Value;

        var openVagas = await db.Vagas.AsNoTracking()
            .CountAsync(v => v.Status == VagaStatus.Aberta, ct);

        int vagasForaSla;
        try
        {
            var vagasAbertasComSla = await db.Vagas.AsNoTracking()
                .Where(v => v.Status == VagaStatus.Aberta && v.DataAbertura != null)
                .Select(v => new { v.DataAbertura, v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade })
                .ToListAsync(ct);
            vagasForaSla = vagasAbertasComSla.Count(v =>
                (now - v.DataAbertura!.Value).TotalDays > SlaVagaMetaResolver.GetDiasMeta(v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade, opts));
        }
        catch (PostgresException ex) when (ex.SqlState == "42703")
        {
            // Coluna de SLA ainda não existe no schema do tenant — migração pendente.
            logger.LogError(ex, "Dashboard KPIs: coluna ausente no schema (SqlState {SqlState}, coluna {Column}). Aplique as migrações pendentes no tenant.",
                ex.SqlState, ex.ColumnName ?? "desconhecida");
            vagasForaSla = 0;
        }

        var cvsHoje = await db.Candidatos.AsNoTracking()
            .CountAsync(c => c.CreatedAtUtc >= todayStart, ct);

        var pendentes = await db.Candidatos.AsNoTracking()
            .CountAsync(c => c.LastMatchAtUtc == null && c.LastMatchScore == null, ct);

        var aprovados = await db.Candidatos.AsNoTracking()
            .CountAsync(c => c.Status == CandidateStatus.Aprovado && c.UpdatedAtUtc >= weekStart, ct);

        return Ok(new DashboardKpisResponse(
            openVagas,
            cvsHoje,
            pendentes,
            aprovados,
            vagasForaSla,
            0
        ));
    }

    /// <summary>
    /// Série diária de candidatos recebidos.
    /// </summary>
    /// <param name="days">Quantidade de dias (1 a 60).</param>
    [HttpGet("recebidos-series")]
    [ProducesResponseType(typeof(DashboardSeriesResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardSeriesResponse>> GetRecebidosSeries(
        [FromQuery] int days,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var safeDays = Math.Clamp(days <= 0 ? 14 : days, 1, 60);
        var today = DateTimeOffset.UtcNow;
        var startDate = new DateTimeOffset(today.Date.AddDays(-(safeDays - 1)), TimeSpan.Zero);

        var createdDates = await db.Candidatos.AsNoTracking()
            .Where(c => c.CreatedAtUtc >= startDate)
            .Select(c => c.CreatedAtUtc.Date)
            .ToListAsync(ct);

        var grouped = createdDates
            .GroupBy(d => d)
            .ToDictionary(g => g.Key, g => g.Count());

        var labels = new List<string>(safeDays);
        var values = new List<int>(safeDays);

        for (var i = 0; i < safeDays; i++)
        {
            var day = startDate.Date.AddDays(i);
            labels.Add(day.ToString("dd/MM"));
            values.Add(grouped.TryGetValue(day, out var count) ? count : 0);
        }

        return Ok(new DashboardSeriesResponse(labels, values));
    }

    /// <summary>
    /// Funil de candidatos por status.
    /// </summary>
    [HttpGet("funil")]
    [ProducesResponseType(typeof(DashboardFunnelResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardFunnelResponse>> GetFunnel(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var total = await db.Candidatos.AsNoTracking().CountAsync(ct);
        var triagem = await db.Candidatos.AsNoTracking()
            .CountAsync(c => c.Status == CandidateStatus.Triagem, ct);
        var pendente = await db.Candidatos.AsNoTracking()
            .CountAsync(c => c.Status == CandidateStatus.Pendente, ct);
        var aprovado = await db.Candidatos.AsNoTracking()
            .CountAsync(c => c.Status == CandidateStatus.Aprovado, ct);

        return Ok(new DashboardFunnelResponse(
            total,
            triagem,
            pendente,
            aprovado
        ));
    }

    /// <summary>
    /// Lista top matches (candidatos com maior score).
    /// </summary>
    /// <param name="minMatch">Score mínimo (0 a 100).</param>
    /// <param name="vagaId">Filtrar por vaga.</param>
    /// <param name="from">Data inicial do match.</param>
    /// <param name="to">Data final do match.</param>
    /// <param name="take">Quantidade de itens (1 a 100).</param>
    [HttpGet("top-matches")]
    [ProducesResponseType(typeof(IReadOnlyList<DashboardTopMatchResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DashboardTopMatchResponse>>> GetTopMatches(
        [FromQuery] int minMatch,
        [FromQuery] Guid? vagaId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int take,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var safeTake = Math.Clamp(take <= 0 ? 12 : take, 1, 100);
        var safeMin = Math.Clamp(minMatch, 0, 100);

        var query = db.Candidatos
            .AsNoTracking()
            .Include(c => c.Vaga)
            .Where(c => c.LastMatchScore != null && c.VagaId != null);

        if (safeMin > 0)
            query = query.Where(c => c.LastMatchScore >= safeMin);

        if (vagaId.HasValue)
            query = query.Where(c => c.VagaId == vagaId.Value);

        if (from.HasValue)
            query = query.Where(c => c.LastMatchAtUtc >= from.Value);

        if (to.HasValue)
            query = query.Where(c => c.LastMatchAtUtc <= to.Value);

        var items = await query
            .OrderByDescending(c => c.LastMatchScore)
            .ThenByDescending(c => c.UpdatedAtUtc)
            .Take(safeTake)
            .Select(c => new DashboardTopMatchResponse(
                c.VagaId!.Value,
                c.Vaga != null ? c.Vaga.Titulo : null,
                c.Vaga != null ? c.Vaga.Codigo : null,
                c.Id,
                c.Nome,
                MapOrigem(c.Fonte),
                c.LastMatchScore ?? 0,
                MapEtapa(c.Status)
            ))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lista vagas abertas para cartões/resumo.
    /// </summary>
    /// <param name="take">Quantidade de itens (1 a 300).</param>
    [HttpGet("open-vagas")]
    [ProducesResponseType(typeof(IReadOnlyList<DashboardOpenVagaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DashboardOpenVagaResponse>>> GetOpenVagas(
        [FromQuery] int take,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var safeTake = Math.Clamp(take <= 0 ? 100 : take, 1, 300);

        var items = await db.Vagas.AsNoTracking()
            .Include(v => v.CentroCusto)
            .Where(v => v.Status == VagaStatus.Aberta)
            .OrderBy(v => v.Titulo)
            .Take(safeTake)
            .Select(v => new DashboardOpenVagaResponse(
                v.Id,
                v.Codigo,
                v.Titulo,
                v.CentroCusto != null ? v.CentroCusto.Description : null,
                v.Modalidade != null ? v.Modalidade.ToString() : null,
                v.Cidade,
                v.Uf,
                v.Senioridade != null ? v.Senioridade.ToString() : null,
                v.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Lookup simples de vagas (id, código e título).
    /// </summary>
    [HttpGet("vagas")]
    [ProducesResponseType(typeof(IReadOnlyList<DashboardVagaLookupResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DashboardVagaLookupResponse>>> GetVagasLookup(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var items = await db.Vagas.AsNoTracking()
            .OrderBy(v => v.Titulo)
            .Select(v => new DashboardVagaLookupResponse(v.Id, v.Codigo, v.Titulo))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Vagas com pelo menos 1 candidato sem matching calculado (<c>LastMatchAtUtc == null</c>).
    /// Usado pela tela de matching quando o usuário chega sem vagaId (via card "candidatos pendentes"
    /// do dashboard) — assim ele escolhe qual vaga trabalhar antes de ver o ranking.
    /// Retorna código, título, status e <c>countPendentes</c> de cada vaga.
    /// </summary>
    [HttpGet("vagas-com-pendentes-match")]
    [ProducesResponseType(typeof(IReadOnlyList<VagaComPendentesMatchResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<VagaComPendentesMatchResponse>>> GetVagasComPendentesMatch(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        // Fase 1 — GROUP BY SQL-puro (materializa contagens por vaga)
        var grupos = await db.Candidatos.AsNoTracking()
            .Where(c => c.VagaId != null && c.LastMatchAtUtc == null && c.LastMatchScore == null)
            .GroupBy(c => c.VagaId!.Value)
            .Select(g => new { VagaId = g.Key, CountPendentes = g.Count() })
            .ToListAsync(ct);

        if (grupos.Count == 0)
            return Ok(Array.Empty<VagaComPendentesMatchResponse>());

        // Fase 2 — join com vagas pelos IDs já materializados (evita LINQ complexo)
        var ids = grupos.Select(g => g.VagaId).ToList();
        var vagas = await db.Vagas.AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .Select(v => new
            {
                v.Id, v.Codigo, v.Titulo,
                Status = v.Status,
                Senioridade = v.Senioridade,
                v.Cidade, v.Uf
            })
            .ToListAsync(ct);

        // Fase 3 — combina em memória e retorna ordenado
        var contagemPorVaga = grupos.ToDictionary(g => g.VagaId, g => g.CountPendentes);
        var response = vagas
            .Select(v => new VagaComPendentesMatchResponse(
                v.Id, v.Codigo, v.Titulo, v.Status.ToString(),
                v.Senioridade?.ToString(),
                v.Cidade, v.Uf,
                contagemPorVaga.GetValueOrDefault(v.Id, 0)))
            .OrderByDescending(r => r.CountPendentes)
            .ToList();

        return Ok(response);
    }

    /// <summary>
    /// Lookup simples de áreas.
    /// </summary>
    [HttpGet("areas")]
    [ProducesResponseType(typeof(IReadOnlyList<DashboardAreaLookupResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DashboardAreaLookupResponse>>> GetAreasLookup(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        // Legacy alias: agora retorna Centros de Custo (após consolidação Area→CentroCusto, Sessão 31.2).
        var items = await db.CentrosCusto.AsNoTracking()
            .Where(a => a.IsActive)
            .OrderBy(a => a.Description)
            .Select(a => new DashboardAreaLookupResponse(a.Id, a.Description))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Indicadores principais da carteira da Analista de RH logada.
    /// Escopo: vagas atribuídas via <c>RecrutadorResponsavelUserId</c> ou distribuição em <c>SolicitacaoVaga</c>.
    /// </summary>
    [HttpGet("analista-rh/kpis")]
    [ProducesResponseType(typeof(DashboardKpisResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardKpisResponse>> GetAnalistaRhKpis(
        [FromServices] AppDbContext db,
        [FromServices] IOptions<SlaVagaOptions> slaOptions,
        [FromServices] ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!userId.HasValue)
            return Ok(new DashboardKpisResponse(0, 0, 0, 0, 0, 0));

        var now = DateTimeOffset.UtcNow;
        var todayStart = new DateTimeOffset(now.Date, TimeSpan.Zero);
        var weekStart = now.AddDays(-7);
        var opts = slaOptions.Value;
        var statusAtivos = SolicitacaoVagaStatusRules.StatusAtivos;

        var vagasCarteira = FilterVagasCarteiraAnalistaRh(db.Vagas.AsNoTracking(), db, userId.Value);

        var openVagas = await vagasCarteira.CountAsync(v => v.Status == VagaStatus.Aberta, ct);

        int vagasForaSla;
        try
        {
            var vagasAbertasComSla = await vagasCarteira
                .Where(v => v.Status == VagaStatus.Aberta && v.DataAbertura != null)
                .Select(v => new { v.DataAbertura, v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade })
                .ToListAsync(ct);

            vagasForaSla = vagasAbertasComSla.Count(v =>
                (now - v.DataAbertura!.Value).TotalDays > SlaVagaMetaResolver.GetDiasMeta(v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade, opts));
        }
        catch (PostgresException ex) when (ex.SqlState == "42703")
        {
            logger.LogError(ex, "Dashboard Analista RH KPIs: coluna ausente no schema (SqlState {SqlState}, coluna {Column}).",
                ex.SqlState, ex.ColumnName ?? "desconhecida");
            vagasForaSla = 0;
        }

        var candidaturasCarteira = FilterCandidaturasCarteiraAnalistaRh(db.Candidaturas.AsNoTracking(), db, userId.Value);

        var cvsHoje = await candidaturasCarteira
            .CountAsync(c => c.AplicadaEmUtc >= todayStart, ct);

        var pendentes = await candidaturasCarteira
            .CountAsync(c => c.Candidato != null && c.Candidato.LastMatchAtUtc == null && c.Candidato.LastMatchScore == null, ct);

        var aprovados = await candidaturasCarteira
            .CountAsync(c => (c.EtapaMacro == EtapaMacroCandidatura.Proposta
                              || c.EtapaMacro == EtapaMacroCandidatura.Contratado
                              || (c.Candidato != null && c.Candidato.Status == CandidateStatus.Aprovado))
                             && c.UpdatedAtUtc >= weekStart, ct);

        var solicitacoesVagaAtivas = await db.SolicitacoesVaga.AsNoTracking()
            .CountAsync(s => s.AnalistaRhResponsavelUserId == userId.Value && statusAtivos.Contains(s.Status), ct);

        return Ok(new DashboardKpisResponse(
            openVagas,
            cvsHoje,
            pendentes,
            aprovados,
            vagasForaSla,
            solicitacoesVagaAtivas
        ));
    }

    /// <summary>
    /// Série diária de candidaturas recebidas nas vagas da Analista de RH logada.
    /// </summary>
    [HttpGet("analista-rh/recebidos-series")]
    [ProducesResponseType(typeof(DashboardSeriesResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardSeriesResponse>> GetAnalistaRhRecebidosSeries(
        [FromQuery] int days,
        [FromServices] AppDbContext db,
        [FromServices] ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var safeDays = Math.Clamp(days <= 0 ? 14 : days, 1, 60);
        var today = DateTimeOffset.UtcNow;
        var startDate = new DateTimeOffset(today.Date.AddDays(-(safeDays - 1)), TimeSpan.Zero);

        var labels = new List<string>(safeDays);
        var values = new List<int>(safeDays);

        Dictionary<DateTime, int> grouped = new();
        if (userId.HasValue)
        {
            var appliedDates = await FilterCandidaturasCarteiraAnalistaRh(db.Candidaturas.AsNoTracking(), db, userId.Value)
                .Where(c => c.AplicadaEmUtc >= startDate)
                .Select(c => c.AplicadaEmUtc.Date)
                .ToListAsync(ct);

            grouped = appliedDates
                .GroupBy(d => d)
                .ToDictionary(g => g.Key, g => g.Count());
        }

        for (var i = 0; i < safeDays; i++)
        {
            var day = startDate.Date.AddDays(i);
            labels.Add(day.ToString("dd/MM"));
            values.Add(grouped.TryGetValue(day, out var count) ? count : 0);
        }

        return Ok(new DashboardSeriesResponse(labels, values));
    }

    /// <summary>
    /// Funil de candidaturas das vagas distribuídas para a Analista de RH logada.
    /// </summary>
    [HttpGet("analista-rh/funil")]
    [ProducesResponseType(typeof(FunilCandidaturasResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FunilCandidaturasResponse>> GetAnalistaRhFunil(
        [FromServices] AppDbContext db,
        [FromServices] ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!userId.HasValue)
            return Ok(new FunilCandidaturasResponse(0, null, null, null, null, Array.Empty<FunilEtapaItem>()));

        var candidaturasCarteira = FilterCandidaturasCarteiraAnalistaRh(db.Candidaturas.AsNoTracking(), db, userId.Value);

        var rows = await candidaturasCarteira
            .GroupBy(c => c.EtapaMacro)
            .Select(g => new { Etapa = g.Key, Total = g.Count() })
            .ToListAsync(ct);

        var counts = rows.ToDictionary(x => x.Etapa, x => x.Total);
        var entrevistaTotal =
            counts.GetValueOrDefault(EtapaMacroCandidatura.Entrevista) +
            counts.GetValueOrDefault(EtapaMacroCandidatura.EntrevistaTecnica);
        var aprovadosTotal = await candidaturasCarteira.CountAsync(CandidaturaConsideradaAprovadaExpression(), ct);

        var etapas = new[]
        {
            new FunilEtapaItem(EtapaMacroCandidatura.Aplicada, "Inscritos", counts.GetValueOrDefault(EtapaMacroCandidatura.Aplicada), null),
            new FunilEtapaItem(EtapaMacroCandidatura.EmTriagem, "Triagem", counts.GetValueOrDefault(EtapaMacroCandidatura.EmTriagem), null),
            new FunilEtapaItem(EtapaMacroCandidatura.Entrevista, "Entrevista", entrevistaTotal, null),
            new FunilEtapaItem(EtapaMacroCandidatura.Teste, "Teste", counts.GetValueOrDefault(EtapaMacroCandidatura.Teste), null),
            new FunilEtapaItem(EtapaMacroCandidatura.Contratado, "Aprovados", aprovadosTotal, null),
        };

        return Ok(new FunilCandidaturasResponse(etapas.Sum(e => e.Total), null, null, null, null, etapas));
    }

    /// <summary>
    /// Eventos de agenda vinculados às vagas da Analista de RH logada.
    /// </summary>
    [HttpGet("analista-rh/agenda-events")]
    [ProducesResponseType(typeof(IReadOnlyList<ScheduleEventResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ScheduleEventResponse>>> GetAnalistaRhAgendaEvents(
        [FromQuery] ScheduleEventsQuery query,
        [FromServices] AppDbContext db,
        [FromServices] ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!userId.HasValue)
            return Ok(Array.Empty<ScheduleEventResponse>());

        var type = (query.Type ?? string.Empty).Trim();
        var status = (query.Status ?? string.Empty).Trim();
        var search = (query.Search ?? string.Empty).Trim();
        var startUtc = query.Start.HasValue ? NormalizeToUtc(query.Start.Value) : (DateTime?)null;
        var endUtc = query.End.HasValue ? NormalizeToUtc(query.End.Value) : (DateTime?)null;
        var ownerTokens = await GetCurrentUserAgendaTokensAsync(db, currentUser, ct);
        var vagasCarteiraIds = await FilterVagasCarteiraAnalistaRh(db.Vagas.AsNoTracking(), db, userId.Value)
            .Select(v => v.Id)
            .ToListAsync(ct);
        var vagasCarteiraSet = vagasCarteiraIds.ToHashSet();

        var eventsQuery = db.AgendaEvents
            .AsNoTracking()
            .Include(x => x.Type)
            .AsQueryable();

        if (startUtc.HasValue)
            eventsQuery = eventsQuery.Where(x => x.StartAtUtc >= startUtc.Value);

        if (endUtc.HasValue)
            eventsQuery = eventsQuery.Where(x => x.StartAtUtc < endUtc.Value);

        if (!string.IsNullOrWhiteSpace(type) && !string.Equals(type, "all", StringComparison.OrdinalIgnoreCase))
            eventsQuery = eventsQuery.Where(x => x.Type != null && x.Type.Code == type);

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
            eventsQuery = eventsQuery.Where(x => x.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            eventsQuery = eventsQuery.Where(x =>
                x.Title.Contains(search) ||
                (x.Candidate != null && x.Candidate.Contains(search)) ||
                (x.VagaTitle != null && x.VagaTitle.Contains(search)) ||
                (x.VagaCode != null && x.VagaCode.Contains(search)) ||
                (x.Owner != null && x.Owner.Contains(search)) ||
                (x.Location != null && x.Location.Contains(search)));
        }

        var rawItems = await eventsQuery
            .OrderBy(x => x.StartAtUtc)
            .Select(x => new ScheduleEventResponse(
                x.Id,
                x.Title,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AllDay,
                x.Status,
                x.Location,
                x.Owner,
                x.Candidate,
                x.VagaTitle,
                x.VagaCode,
                x.Notes,
                x.CandidaturaId,
                x.CandidatoId,
                x.VagaId,
                x.CandidateResponseStatus,
                x.CandidateRespondedAtUtc,
                x.CandidateSuggestedStartAtUtc,
                x.CandidateSuggestedEndAtUtc,
                x.CandidateResponseMessage,
                x.CandidateConfirmationToken,
                x.Type != null ? x.Type.Code : string.Empty,
                x.Type != null ? x.Type.Label : string.Empty,
                x.Type != null ? x.Type.Color : "#6c757d",
                x.Type != null ? x.Type.Icon : "bi-calendar"
            ))
            .ToListAsync(ct);

        var items = rawItems
            .Where(x =>
                (x.VagaId.HasValue && vagasCarteiraSet.Contains(x.VagaId.Value))
                || AgendaOwnerMatches(x.Owner, ownerTokens)
                || AgendaParticipantMatches(x.Notes, ownerTokens))
            .ToList();

        return Ok(items);
    }

    /// <summary>
    /// Requisições distribuídas para a Analista de RH logada.
    /// </summary>
    [HttpGet("analista-rh/solicitacoes-vaga")]
    [ProducesResponseType(typeof(IReadOnlyList<AnalistaRhDashboardSolicitacaoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AnalistaRhDashboardSolicitacaoResponse>>> GetAnalistaRhSolicitacoesVaga(
        [FromQuery(Name = "statuses")] SolicitacaoStatus[]? statuses,
        [FromQuery] int? pageSize,
        [FromServices] AppDbContext db,
        [FromServices] ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (!userId.HasValue)
            return Ok(Array.Empty<AnalistaRhDashboardSolicitacaoResponse>());

        var safePageSize = Math.Clamp(pageSize.GetValueOrDefault(20), 1, 100);
        var query = db.SolicitacoesVaga.AsNoTracking()
            .Where(s => s.AnalistaRhResponsavelUserId == userId.Value);

        if (statuses is { Length: > 0 })
            query = query.Where(s => statuses.Contains(s.Status));

        var items = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .Take(safePageSize)
            .Select(s => new AnalistaRhDashboardSolicitacaoResponse(
                s.Id,
                s.Titulo,
                s.Status,
                s.CentroCusto != null ? s.CentroCusto.Description : null,
                s.Unit != null ? s.Unit.Name : null,
                s.CreatedAtUtc,
                s.RmIdReq
            ))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// KPIs globais da Especialista de RH.
    /// </summary>
    [HttpGet("especialista-rh/kpis")]
    [ProducesResponseType(typeof(EspecialistaRhDashboardKpisResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EspecialistaRhDashboardKpisResponse>> GetEspecialistaRhKpis(
        [FromServices] AppDbContext db,
        [FromServices] IOptions<SlaVagaOptions> slaOptions,
        [FromServices] ISolicitacaoVagaService solicitacaoVagaService,
        [FromServices] ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var inicioMes = new DateTimeOffset(new DateTime(now.Year, now.Month, 1), TimeSpan.Zero);
        var opts = slaOptions.Value;

        var contagens = await solicitacaoVagaService.GetContagensAsync(apenasMeus: false, currentUser.FuncionarioId, ct);
        var solicitacoesAtivas = contagens.Ativas;
        var aguardandoDistribuicao = contagens.AguardandoDistribuicao;

        var vagasAbertas = await db.Vagas.AsNoTracking()
            .CountAsync(v => !v.IsEstrutural && v.Status == VagaStatus.Aberta, ct);

        int vagasForaSla;
        try
        {
            var vagasComSla = await db.Vagas.AsNoTracking()
                .Where(v => !v.IsEstrutural && v.Status == VagaStatus.Aberta && v.DataAbertura != null)
                .Select(v => new { v.DataAbertura, v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade })
                .ToListAsync(ct);

            vagasForaSla = vagasComSla.Count(v =>
                (now - v.DataAbertura!.Value).TotalDays > SlaVagaMetaResolver.GetDiasMeta(v.SlaDiasMetaFechamento, v.Urgente, v.Prioridade, opts));
        }
        catch (PostgresException ex) when (ex.SqlState == "42703")
        {
            logger.LogError(ex, "Dashboard Especialista RH: coluna de SLA ausente no schema do tenant.");
            vagasForaSla = 0;
        }

        var candidatosAvancados = await db.Candidaturas.AsNoTracking()
            .CountAsync(c =>
                c.Status == CandidaturaStatus.Ativa
                && (c.EtapaMacro == EtapaMacroCandidatura.Entrevista
                    || c.EtapaMacro == EtapaMacroCandidatura.EntrevistaTecnica
                    || c.EtapaMacro == EtapaMacroCandidatura.Teste
                    || c.EtapaMacro == EtapaMacroCandidatura.Proposta), ct);

        var preAdmissoesAguardandoAprovacao = await db.PreAdmissoes.AsNoTracking()
            .CountAsync(p => p.Status == PreAdmissaoStatus.Preenchido && p.UpdatedAtUtc >= inicioMes.AddMonths(-2), ct);

        return Ok(new EspecialistaRhDashboardKpisResponse(
            solicitacoesAtivas,
            aguardandoDistribuicao,
            vagasAbertas,
            vagasForaSla,
            candidatosAvancados,
            preAdmissoesAguardandoAprovacao
        ));
    }

    /// <summary>
    /// Funil global de candidaturas para acompanhamento da Especialista de RH.
    /// </summary>
    [HttpGet("especialista-rh/funil")]
    [ProducesResponseType(typeof(EspecialistaRhDashboardFunilResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<EspecialistaRhDashboardFunilResponse>> GetEspecialistaRhFunil(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var inicioMes = new DateTimeOffset(new DateTime(DateTimeOffset.UtcNow.Year, DateTimeOffset.UtcNow.Month, 1), TimeSpan.Zero);

        var aplicadas = await db.Candidaturas.AsNoTracking()
            .CountAsync(c => c.Status == CandidaturaStatus.Ativa && c.EtapaMacro == EtapaMacroCandidatura.Aplicada, ct);
        var triagem = await db.Candidaturas.AsNoTracking()
            .CountAsync(c => c.Status == CandidaturaStatus.Ativa && c.EtapaMacro == EtapaMacroCandidatura.EmTriagem, ct);
        var entrevista = await db.Candidaturas.AsNoTracking()
            .CountAsync(c => c.Status == CandidaturaStatus.Ativa && (c.EtapaMacro == EtapaMacroCandidatura.Entrevista || c.EtapaMacro == EtapaMacroCandidatura.EntrevistaTecnica), ct);
        var teste = await db.Candidaturas.AsNoTracking()
            .CountAsync(c => c.Status == CandidaturaStatus.Ativa && c.EtapaMacro == EtapaMacroCandidatura.Teste, ct);
        var proposta = await db.Candidaturas.AsNoTracking()
            .CountAsync(c => c.Status == CandidaturaStatus.Ativa && c.EtapaMacro == EtapaMacroCandidatura.Proposta, ct);
        var contratadoMes = await db.Candidaturas.AsNoTracking()
            .CountAsync(c => c.Status == CandidaturaStatus.Contratado && c.UpdatedAtUtc >= inicioMes, ct);

        return Ok(new EspecialistaRhDashboardFunilResponse(aplicadas, triagem, entrevista, teste, proposta, contratadoMes));
    }

    /// <summary>
    /// Requisições RM recentes, com foco em distribuição e supervisão.
    /// </summary>
    [HttpGet("especialista-rh/solicitacoes-rm")]
    [ProducesResponseType(typeof(IReadOnlyList<EspecialistaRhDashboardRequisicaoResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<EspecialistaRhDashboardRequisicaoResponse>>> GetEspecialistaRhSolicitacoesRm(
        [FromQuery] int? pageSize,
        [FromQuery] bool? onlyPendingDistribution,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var safePageSize = Math.Clamp(pageSize.GetValueOrDefault(8), 1, 50);
        var statusAtivos = SolicitacaoVagaStatusRules.StatusAtivos;

        var query = db.SolicitacoesVaga.AsNoTracking()
            .Where(s => s.RmIdReq != null);

        if (onlyPendingDistribution == true)
            query = query.Where(s => s.AnalistaRhResponsavelUserId == null && statusAtivos.Contains(s.Status));

        var items = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .Take(safePageSize)
            .Select(s => new EspecialistaRhDashboardRequisicaoResponse(
                s.Id,
                s.Titulo,
                s.Status,
                s.CentroCusto != null ? s.CentroCusto.Description : null,
                s.Unit != null ? s.Unit.Name : null,
                s.CreatedAtUtc,
                s.RmIdReq,
                s.AnalistaRhResponsavelUser != null ? s.AnalistaRhResponsavelUser.FullName : null
            ))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Carga de trabalho por Analista de RH.
    /// </summary>
    [HttpGet("especialista-rh/distribuicao-analistas")]
    [ProducesResponseType(typeof(IReadOnlyList<EspecialistaRhDashboardDistribuicaoAnalistaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<EspecialistaRhDashboardDistribuicaoAnalistaResponse>>> GetEspecialistaRhDistribuicaoAnalistas(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var end = now.AddDays(30);
        var statusAtivos = SolicitacaoVagaStatusRules.StatusAtivos;

        var analistas = await (
                from user in db.Users.AsNoTracking()
                join userRole in db.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
                join role in db.Roles.AsNoTracking() on userRole.RoleId equals role.Id
                where user.IsActive && role.Name == "Analista de RH"
                select new { user.Id, user.FullName, user.Email }
            )
            .Distinct()
            .ToListAsync(ct);

        if (analistas.Count == 0)
            return Ok(Array.Empty<EspecialistaRhDashboardDistribuicaoAnalistaResponse>());

        var analistaIds = analistas.Select(a => a.Id).ToList();

        var requisicoesPorAnalista = await db.SolicitacoesVaga.AsNoTracking()
            .Where(s => s.AnalistaRhResponsavelUserId != null
                && analistaIds.Contains(s.AnalistaRhResponsavelUserId.Value)
                && statusAtivos.Contains(s.Status))
            .GroupBy(s => s.AnalistaRhResponsavelUserId!.Value)
            .Select(g => new { AnalistaUserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.AnalistaUserId, x => x.Count, ct);

        var vagasPorAnalista = await db.Vagas.AsNoTracking()
            .Where(v => v.RecrutadorResponsavelUserId != null
                && analistaIds.Contains(v.RecrutadorResponsavelUserId.Value)
                && !v.IsEstrutural
                && v.Status == VagaStatus.Aberta)
            .GroupBy(v => v.RecrutadorResponsavelUserId!.Value)
            .Select(g => new { AnalistaUserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.AnalistaUserId, x => x.Count, ct);

        var candidaturasPorAnalista = await db.Candidaturas.AsNoTracking()
            .Where(c => c.Vaga != null
                && c.Vaga.RecrutadorResponsavelUserId != null
                && analistaIds.Contains(c.Vaga.RecrutadorResponsavelUserId.Value)
                && c.Status == CandidaturaStatus.Ativa)
            .GroupBy(c => c.Vaga!.RecrutadorResponsavelUserId!.Value)
            .Select(g => new { AnalistaUserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.AnalistaUserId, x => x.Count, ct);

        var entrevistasPorAnalista = await (
                from evento in db.AgendaEvents.AsNoTracking()
                join vaga in db.Vagas.AsNoTracking() on evento.VagaId equals vaga.Id
                where vaga.RecrutadorResponsavelUserId != null
                    && analistaIds.Contains(vaga.RecrutadorResponsavelUserId.Value)
                    && evento.StartAtUtc >= now
                    && evento.StartAtUtc < end
                    && evento.Status != "cancelled"
                group evento by vaga.RecrutadorResponsavelUserId!.Value into g
                select new { AnalistaUserId = g.Key, Count = g.Count() }
            )
            .ToDictionaryAsync(x => x.AnalistaUserId, x => x.Count, ct);

        var result = analistas
            .OrderBy(a => a.FullName)
            .Select(a => new EspecialistaRhDashboardDistribuicaoAnalistaResponse(
                a.Id,
                string.IsNullOrWhiteSpace(a.FullName) ? a.Email ?? "Analista" : a.FullName,
                requisicoesPorAnalista.GetValueOrDefault(a.Id),
                vagasPorAnalista.GetValueOrDefault(a.Id),
                candidaturasPorAnalista.GetValueOrDefault(a.Id),
                entrevistasPorAnalista.GetValueOrDefault(a.Id)
            ))
            .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Próximos eventos globais de agenda para a Especialista de RH.
    /// </summary>
    [HttpGet("especialista-rh/agenda-events")]
    [ProducesResponseType(typeof(IReadOnlyList<ScheduleEventResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ScheduleEventResponse>>> GetEspecialistaRhAgendaEvents(
        [FromQuery] int? pageSize,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var end = now.AddDays(30);
        var safePageSize = Math.Clamp(pageSize.GetValueOrDefault(8), 1, 50);

        var items = await db.AgendaEvents.AsNoTracking()
            .Include(x => x.Type)
            .Where(x => x.StartAtUtc >= now && x.StartAtUtc < end && x.Status != "cancelled")
            .OrderBy(x => x.StartAtUtc)
            .Take(safePageSize)
            .Select(x => new ScheduleEventResponse(
                x.Id,
                x.Title,
                x.StartAtUtc,
                x.EndAtUtc,
                x.AllDay,
                x.Status,
                x.Location,
                x.Owner,
                x.Candidate,
                x.VagaTitle,
                x.VagaCode,
                x.Notes,
                x.CandidaturaId,
                x.CandidatoId,
                x.VagaId,
                x.CandidateResponseStatus,
                x.CandidateRespondedAtUtc,
                x.CandidateSuggestedStartAtUtc,
                x.CandidateSuggestedEndAtUtc,
                x.CandidateResponseMessage,
                x.CandidateConfirmationToken,
                x.Type != null ? x.Type.Code : string.Empty,
                x.Type != null ? x.Type.Label : string.Empty,
                x.Type != null ? x.Type.Color : "#6c757d",
                x.Type != null ? x.Type.Icon : "bi-calendar"
            ))
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>
    /// Alertas globais para supervisão da Especialista de RH.
    /// </summary>
    [HttpGet("especialista-rh/alertas")]
    [ProducesResponseType(typeof(IReadOnlyList<EspecialistaRhDashboardAlertaResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<EspecialistaRhDashboardAlertaResponse>>> GetEspecialistaRhAlertas(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var inicioSemana = DateTimeOffset.UtcNow.AddDays(-7);
        var statusAtivos = SolicitacaoVagaStatusRules.StatusAtivos;

        var notificacoesFalhadas = await db.NotificacoesCandidaturaLogs.AsNoTracking()
            .CountAsync(n => n.Status == NotificacaoStatus.Falhou && n.CriadoEmUtc >= inicioSemana, ct);

        var matchesPendentes = await db.Candidatos.AsNoTracking()
            .CountAsync(c => c.LastMatchAtUtc == null && c.LastMatchScore == null, ct);

        var faixasPendentes = await db.AprovacoesFaixaSalarial.AsNoTracking()
            .CountAsync(a => a.Status == StatusAprovacaoFaixa.Pendente, ct);

        var requisicoesSemAnalista = await db.SolicitacoesVaga.AsNoTracking()
            .CountAsync(s => s.AnalistaRhResponsavelUserId == null && statusAtivos.Contains(s.Status), ct);

        return Ok(new[]
        {
            new EspecialistaRhDashboardAlertaResponse("Requisições sem Analista", "Solicitações ativas aguardando distribuição para o time de RH.", requisicoesSemAnalista, requisicoesSemAnalista > 0 ? "amber" : "green"),
            new EspecialistaRhDashboardAlertaResponse("Matching pendente", "Candidatos ainda sem análise de aderência por IA.", matchesPendentes, matchesPendentes > 0 ? "purple" : "green"),
            new EspecialistaRhDashboardAlertaResponse("Faixas salariais", "Aprovações de faixa salarial aguardando decisão.", faixasPendentes, faixasPendentes > 0 ? "red" : "green"),
            new EspecialistaRhDashboardAlertaResponse("Notificações falhadas", "Falhas de comunicação com candidatos nos últimos 7 dias.", notificacoesFalhadas, notificacoesFalhadas > 0 ? "red" : "green"),
        });
    }

    /// <summary>
    /// Dashboard agregado por perfil (Sessão 31). Substitui a colcha de retalhos
    /// de chamadas isoladas no frontend por uma única resposta ricamente tipada,
    /// que concentra KPIs + rankings necessários para as telas "Gestor", "RH" e
    /// "Diretor".
    /// </summary>
    /// <param name="perfil">
    /// "gestor", "rh" ou "diretor". Valores inválidos retornam 400.
    /// Para "gestor" sem <c>FuncionarioId</c> vinculado (usuário sem colaborador no tenant),
    /// a seção vem <c>null</c> — o frontend mostra aviso "perfil indisponível" em vez de 403.
    /// </param>
    [HttpGet("agregado")]
    [ProducesResponseType(typeof(DashboardAgregadoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DashboardAgregadoResponse>> GetAgregado(
        [FromQuery] string perfil,
        [FromServices] IDashboardAgregadoService agregado,
        [FromServices] ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        try
        {
            var resposta = await agregado.ObterAsync(perfil, currentUser.FuncionarioId, ct);
            return Ok(resposta);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private static IQueryable<Vaga> FilterVagasCarteiraAnalistaRh(IQueryable<Vaga> query, AppDbContext db, Guid userId)
        => query.Where(v =>
            v.RecrutadorResponsavelUserId == userId
            || db.SolicitacoesVaga.Any(s =>
                s.VagaId == v.Id && s.AnalistaRhResponsavelUserId == userId));

    private static IQueryable<Candidatura> FilterCandidaturasCarteiraAnalistaRh(
        IQueryable<Candidatura> query,
        AppDbContext db,
        Guid userId)
        => query.Where(c =>
            db.Vagas.Any(v =>
                v.Id == c.VagaId
                && (v.RecrutadorResponsavelUserId == userId
                    || db.SolicitacoesVaga.Any(s =>
                        s.VagaId == v.Id && s.AnalistaRhResponsavelUserId == userId))));

    private static System.Linq.Expressions.Expression<Func<Candidatura, bool>> CandidaturaConsideradaAprovadaExpression()
        => c => c.EtapaMacro == EtapaMacroCandidatura.Proposta
                || c.EtapaMacro == EtapaMacroCandidatura.Contratado
                || (c.Candidato != null && c.Candidato.Status == CandidateStatus.Aprovado);

    private static string MapOrigem(CandidateOrigin fonte)
    {
        return fonte switch
        {
            CandidateOrigin.Email => "Email",
            CandidateOrigin.Pasta => "Pasta",
            CandidateOrigin.LinkedIn => "LinkedIn",
            CandidateOrigin.Indicacao => "Indicacao",
            CandidateOrigin.Site => "Site",
            _ => "Outro"
        };
    }

    private static string MapEtapa(CandidateStatus status)
    {
        return status switch
        {
            CandidateStatus.Novo => "Recebido",
            CandidateStatus.Triagem => "Triagem",
            CandidateStatus.Pendente => "Entrevista",
            CandidateStatus.Aprovado => "Aprovado",
            CandidateStatus.Reprovado => "Reprovado",
            _ => "Triagem"
        };
    }

    private static bool AgendaOwnerMatches(string? owner, IReadOnlySet<string> tokens)
    {
        if (string.IsNullOrWhiteSpace(owner) || tokens.Count == 0)
            return false;

        var normalizedOwner = NormalizeAgendaText(owner);
        return tokens.Any(token => normalizedOwner.Contains(token, StringComparison.Ordinal));
    }

    private static bool AgendaParticipantMatches(string? notes, IReadOnlySet<string> tokens)
    {
        if (string.IsNullOrWhiteSpace(notes) || tokens.Count == 0)
            return false;

        var normalizedNotes = NormalizeAgendaText(notes);
        return tokens.Any(token => normalizedNotes.Contains(token, StringComparison.Ordinal));
    }

    private static async Task<IReadOnlySet<string>> GetCurrentUserAgendaTokensAsync(
        AppDbContext db,
        ICurrentUserContext currentUser,
        CancellationToken ct)
    {
        var tokens = new HashSet<string>(StringComparer.Ordinal);

        void AddToken(string? value)
        {
            var normalized = NormalizeAgendaText(value);
            if (normalized.Length >= 3)
                tokens.Add(normalized);
        }

        AddToken(currentUser.Email);

        if (currentUser.UserId.HasValue)
        {
            var user = await db.Users.AsNoTracking()
                .Where(u => u.Id == currentUser.UserId.Value)
                .Select(u => new { u.FullName, u.Email, u.UserName })
                .FirstOrDefaultAsync(ct);

            if (user is not null)
            {
                AddToken(user.FullName);
                AddToken(user.Email);
                AddToken(user.UserName);
            }
        }

        return tokens;
    }

    private static string NormalizeAgendaText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var normalized = value.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                builder.Append(char.ToLowerInvariant(c));
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private static DateTime NormalizeToUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc) return value;
        if (value.Kind == DateTimeKind.Local) return value.ToUniversalTime();
        return DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}
