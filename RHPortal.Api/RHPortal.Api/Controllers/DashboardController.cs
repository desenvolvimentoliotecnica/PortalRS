using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using RhPortal.Api.Contracts.Dashboard;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Configuration;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

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
            vagasForaSla
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
            .Include(v => v.Area)
            .Where(v => v.Status == VagaStatus.Aberta)
            .OrderBy(v => v.Titulo)
            .Take(safeTake)
            .Select(v => new DashboardOpenVagaResponse(
                v.Id,
                v.Codigo,
                v.Titulo,
                v.Area != null ? v.Area.Name : null,
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
    /// Lookup simples de áreas.
    /// </summary>
    [HttpGet("areas")]
    [ProducesResponseType(typeof(IReadOnlyList<DashboardAreaLookupResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DashboardAreaLookupResponse>>> GetAreasLookup(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var items = await db.Areas.AsNoTracking()
            .OrderBy(a => a.Name)
            .Select(a => new DashboardAreaLookupResponse(a.Id, a.Name))
            .ToListAsync(ct);

        return Ok(items);
    }

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
}
