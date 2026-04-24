using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints de Gestão de equipe (dashboard, resumo de atividades, humor, planos).
/// </summary>
[ApiController]
[Route("api/gestao")]
[RequireModule("gestao")]
public sealed class GestaoController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _userContext;

    public GestaoController(AppDbContext db, ICurrentUserContext userContext)
    {
        _db = db;
        _userContext = userContext;
    }

    /// <summary>KPIs do dashboard de gestão.</summary>
    [HttpGet("dashboard/kpis")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DashboardKpis(CancellationToken ct)
    {
        var planosAtivos = await _db.DevelopmentPlans.AsNoTracking().CountAsync(ct);
        var reunioes = await _db.OneOnOneMeetings.AsNoTracking()
            .Where(m => m.MeetingDate >= DateTimeOffset.UtcNow.AddDays(-30))
            .CountAsync(ct);
        var metasConcluidas = await _db.DevelopmentPlanGoals.AsNoTracking()
            .Where(g => g.ConcludedAt != null)
            .CountAsync(ct);

        var moods = await _db.MoodEntries.AsNoTracking()
            .Where(e => e.CreatedAtUtc >= DateTimeOffset.UtcNow.AddDays(-30))
            .Select(e => e.Mood)
            .ToListAsync(ct);

        return Ok(new { planosAtivos, humorMedio = AverageMoodLabel(moods), reunioes1a1 = reunioes, metasConcluidas });
    }

    /// <summary>Atividades recentes.</summary>
    [HttpGet("dashboard/recent-activities")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RecentActivities([FromQuery] int take = 5, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        var items = await _db.FeedbackItems.AsNoTracking()
            .OrderByDescending(f => f.CreatedAtUtc).Take(take)
            .Select(f => new { id = f.Id.ToString(), type = "feedback", description = f.Content ?? "", createdAtUtc = f.CreatedAtUtc })
            .ToListAsync(ct);
        return Ok(items);
    }

    /// <summary>Próximas ações/reuniões agendadas.</summary>
    [HttpGet("dashboard/upcoming-actions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpcomingActions([FromQuery] int take = 5, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        var items = await _db.OneOnOneMeetings.AsNoTracking()
            .Where(m => m.MeetingDate >= DateTimeOffset.UtcNow)
            .OrderBy(m => m.MeetingDate).Take(take)
            .Select(m => new { id = m.Id.ToString(), type = "meeting", description = m.Subject ?? "Reunião 1:1", dueAtUtc = m.MeetingDate })
            .ToListAsync(ct);
        return Ok(items);
    }

    /// <summary>Resumo de atividades (feedbacks, celebrações, reuniões, planos).</summary>
    [HttpGet("resumo/summary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ResumoSummary(CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-30);
        var feedbacksSent = await _db.FeedbackItems.AsNoTracking().CountAsync(f => f.CreatedAtUtc >= since, ct);
        var celebrationsPosted = await _db.CelebrationPosts.AsNoTracking().CountAsync(c => c.CreatedAtUtc >= since, ct);
        var meetingsCompleted = await _db.OneOnOneMeetings.AsNoTracking().CountAsync(m => m.MeetingDate >= since, ct);
        var plansConcluded = await _db.DevelopmentPlanGoals.AsNoTracking().CountAsync(g => g.ConcludedAt != null && g.ConcludedAt >= since, ct);

        return Ok(new
        {
            feedbacksSent, feedbacksReceived = 0, celebrationsPosted, meetingsCompleted, plansConcluded,
            totalPoints = feedbacksSent * 10 + celebrationsPosted * 5 + meetingsCompleted * 15 + plansConcluded * 20
        });
    }

    /// <summary>Timeline de atividades recentes.</summary>
    [HttpGet("resumo/timeline")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ResumoTimeline([FromQuery] int take = 15, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        var items = await _db.FeedbackItems.AsNoTracking()
            .OrderByDescending(f => f.CreatedAtUtc).Take(take)
            .Select(f => new { id = f.Id.ToString(), type = "feedback", description = f.Content ?? "", actorName = "", createdAtUtc = f.CreatedAtUtc })
            .ToListAsync(ct);
        return Ok(items);
    }

    /// <summary>Estatísticas de humor da equipe.</summary>
    [HttpGet("humor/stats")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> HumorStats(CancellationToken ct)
    {
        var entries = await _db.MoodEntries.AsNoTracking()
            .Where(e => e.CreatedAtUtc >= DateTimeOffset.UtcNow.AddDays(-30))
            .Select(e => e.Mood)
            .ToListAsync(ct);

        var total = entries.Count;
        var groups = entries.GroupBy(x => x).Select(g => new { mood = g.Key, count = g.Count(), percentage = total > 0 ? Math.Round(g.Count() * 100.0 / total, 1) : 0 }).ToList();
        return Ok(new { averageMood = AverageMoodLabel(entries), totalResponses = total, distribution = groups });
    }

    /// <summary>Registros recentes de humor.</summary>
    [HttpGet("humor/recent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> HumorRecent([FromQuery] int take = 10, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        var items = await _db.MoodEntries.AsNoTracking()
            .OrderByDescending(e => e.CreatedAtUtc).Take(take)
            .Select(e => new { id = e.Id.ToString(), userId = e.UserId.ToString(), fullName = "", mood = e.Mood, createdAtUtc = e.CreatedAtUtc })
            .ToListAsync(ct);
        return Ok(items);
    }

    /// <summary>Planos de desenvolvimento da equipe.</summary>
    [HttpGet("planos")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Planos(CancellationToken ct)
    {
        var plans = await _db.DevelopmentPlans.AsNoTracking()
            .Include(p => p.Goals)
            .OrderByDescending(p => p.CreatedAtUtc).Take(100)
            .ToListAsync(ct);

        var result = plans.Select(p =>
        {
            var total = p.Goals?.Count ?? 0;
            var done = p.Goals?.Count(g => g.ConcludedAt != null) ?? 0;
            var latestDue = p.Goals?.Where(g => g.DueDate.HasValue).OrderByDescending(g => g.DueDate).FirstOrDefault()?.DueDate;
            var anyOverdue = p.Goals?.Any(g => g.ConcludedAt == null && g.DueDate.HasValue && g.DueDate < DateTimeOffset.UtcNow) == true;
            var status = done == total && total > 0 ? "completed" : anyOverdue ? "overdue" : "in_progress";
            return new
            {
                id = p.Id.ToString(), title = p.Title, responsibleName = "",
                status, dueDate = latestDue?.ToString("yyyy-MM-dd") ?? "",
                progress = total > 0 ? (int)Math.Round(done * 100.0 / total) : 0,
                createdAtUtc = p.CreatedAtUtc
            };
        });
        return Ok(result);
    }

    // ── MSS: Meu Time ──

    /// <summary>Lista os subordinados do gestor logado com indicadores de experiência e aniversário.
    /// Inclui funcionários vinculados por GestorDiretoId e por unidades de lotação onde o gestor é responsável (e sub-unidades).</summary>
    [HttpGet("meu-time")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MeuTime(CancellationToken ct)
    {
        var gestorId = _userContext.FuncionarioId;
        if (gestorId is null)
            return Ok(Array.Empty<object>());

        var today = DateOnly.FromDateTime(DateTime.Today);

        // Resolve unidades de lotação cuja responsabilidade é do gestor (e sub-unidades recursivas)
        var todasUnidades = await _db.UnidadesLotacao.AsNoTracking()
            .Where(u => u.IsActive)
            .Select(u => new { u.Id, u.ParentId, u.OwnerFuncionarioId })
            .ToListAsync(ct);

        var unidadesDoGestor = new HashSet<Guid>();
        var fila = new Queue<Guid>(
            todasUnidades.Where(u => u.OwnerFuncionarioId == gestorId).Select(u => u.Id));
        while (fila.Count > 0)
        {
            var unitId = fila.Dequeue();
            if (!unidadesDoGestor.Add(unitId)) continue;
            foreach (var child in todasUnidades.Where(u => u.ParentId == unitId))
                fila.Enqueue(child.Id);
        }

        var subordinados = await _db.Funcionarios.AsNoTracking()
            .Include(f => f.JobPosition)
            .Include(f => f.Area)
            .Include(f => f.UnidadeLotacao)
            .Where(f => f.Status == FuncionarioStatus.Active
                && f.Id != gestorId
                && (f.GestorDiretoId == gestorId
                    || (f.UnidadeLotacaoId != null && unidadesDoGestor.Contains(f.UnidadeLotacaoId.Value))))
            .Select(f => new
            {
                f.Id,
                f.Name,
                f.Email,
                cargo = f.JobPosition != null ? f.JobPosition.Description : null,
                area = f.Area != null ? f.Area.Description : null,
                f.AvatarFileName,
                f.DataAdmissao,
                f.PeriodoExperienciaDias,
                f.Status,
                f.DataNascimento,
                unidadeLotacaoId = f.UnidadeLotacaoId,
                unidadeLotacaoNome = f.UnidadeLotacao != null ? f.UnidadeLotacao.Description : null,
                unidadeLotacaoParentId = f.UnidadeLotacao != null ? f.UnidadeLotacao.ParentId : null,
            })
            .ToListAsync(ct);

        var result = subordinados.Select(f =>
        {
            var emExperiencia = f.DataAdmissao.HasValue &&
                f.DataAdmissao.Value.AddDays(f.PeriodoExperienciaDias) > today;

            var diasRestantesExperiencia = emExperiencia
                ? (int)(f.DataAdmissao!.Value.AddDays(f.PeriodoExperienciaDias).ToDateTime(TimeOnly.MinValue) - DateTime.Today).TotalDays
                : (int?)null;

            DateOnly? proximoAniversario = null;
            int? diasParaAniversario = null;
            if (f.DataNascimento.HasValue)
            {
                var dn = f.DataNascimento.Value;
                var aniversarioEsteAno = new DateOnly(today.Year, dn.Month, dn.Day);
                if (aniversarioEsteAno < today)
                    aniversarioEsteAno = new DateOnly(today.Year + 1, dn.Month, dn.Day);
                proximoAniversario = aniversarioEsteAno;
                diasParaAniversario = aniversarioEsteAno.DayNumber - today.DayNumber;
            }

            return new
            {
                id = f.Id,
                nome = f.Name,
                email = f.Email,
                cargo = f.cargo,
                area = f.area,
                avatarUrl = !string.IsNullOrWhiteSpace(f.AvatarFileName)
                    ? $"/api/funcionarios/{f.Id}/avatar"
                    : null,
                dataAdmissao = f.DataAdmissao,
                emExperiencia,
                diasRestantesExperiencia,
                progressoExperiencia = emExperiencia && f.DataAdmissao.HasValue
                    ? (int)Math.Round(
                        (DateTime.Today - f.DataAdmissao.Value.ToDateTime(TimeOnly.MinValue)).TotalDays
                        / f.PeriodoExperienciaDias * 100)
                    : (int?)null,
                proximoAniversario,
                diasParaAniversario
            };
        })
        .OrderBy(f => f.nome)
        .ToList();

        return Ok(result);
    }

    /// <summary>Funcionários do time do gestor com aniversário nos próximos N dias.</summary>
    [HttpGet("aniversarios")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Aniversarios([FromQuery] int dias = 30, CancellationToken ct = default)
    {
        dias = Math.Clamp(dias, 1, 365);
        var gestorId = _userContext.FuncionarioId;
        var today = DateOnly.FromDateTime(DateTime.Today);

        // Busca todos os subordinados com DataNascimento preenchida
        IQueryable<Funcionario> q = _db.Funcionarios.AsNoTracking()
            .Where(f => f.DataNascimento.HasValue && f.Status == FuncionarioStatus.Active);

        if (gestorId.HasValue && !_userContext.IsAdmin && !_userContext.IsRH)
            q = q.Where(f => f.GestorDiretoId == gestorId);

        var lista = await q
            .Select(f => new { f.Id, f.Name, f.DataNascimento, f.AvatarFileName })
            .ToListAsync(ct);

        var result = lista
            .Select(f =>
            {
                var dn = f.DataNascimento!.Value;
                var anivEsteAno = new DateOnly(today.Year, dn.Month, dn.Day);
                if (anivEsteAno < today) anivEsteAno = new DateOnly(today.Year + 1, dn.Month, dn.Day);
                var diasFaltando = anivEsteAno.DayNumber - today.DayNumber;
                return new { f.Id, f.Name, f.AvatarFileName, diasFaltando, dataAniversario = anivEsteAno };
            })
            .Where(x => x.diasFaltando <= dias)
            .OrderBy(x => x.diasFaltando)
            .ToList();

        return Ok(result);
    }

    /// <summary>Resumo de headcount da área do gestor logado.</summary>
    [HttpGet("headcount-area")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> HeadcountArea(CancellationToken ct)
    {
        var areaId = _userContext.AreaId;
        if (areaId is null && !_userContext.IsAdmin)
            return Ok(new { autorizado = 0, ocupado = 0, disponivel = 0, provisorio = 0 });

        var vagasQ = _db.Vagas.AsNoTracking();
        if (areaId.HasValue) vagasQ = vagasQ.Where(v => v.AreaId == areaId);

        var vagas = await vagasQ
            .Select(v => new { v.HeadcountAutorizado, v.HeadcountProvisorio })
            .ToListAsync(ct);

        var autorizado = vagas.Sum(v => v.HeadcountAutorizado);
        var provisorio = vagas.Sum(v => v.HeadcountProvisorio);

        // Ocupado = slots ativos sem DataSaida
        var ocupadoQ = _db.OcupacoesHistorico.AsNoTracking()
            .Where(h => h.DataSaida == null);
        if (areaId.HasValue)
        {
            var vagaIds = await _db.Vagas.AsNoTracking()
                .Where(v => v.AreaId == areaId)
                .Select(v => v.Id)
                .ToListAsync(ct);
            ocupadoQ = ocupadoQ.Where(h => h.VagaId.HasValue && vagaIds.Contains(h.VagaId.Value));
        }
        var ocupado = await ocupadoQ.CountAsync(ct);

        return Ok(new
        {
            autorizado,
            ocupado,
            disponivel = Math.Max(0, autorizado - ocupado),
            provisorio
        });
    }

    private static string AverageMoodLabel(List<string> moods)
    {
        if (moods.Count == 0) return "—";
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            { ["very_bad"] = 1, ["bad"] = 2, ["neutral"] = 3, ["good"] = 4, ["great"] = 5 };
        var avg = moods.Select(m => map.TryGetValue(m ?? "", out var v) ? v : 3).Average();
        return avg switch { < 1.5 => "Muito mal", < 2.5 => "Mal", < 3.5 => "Neutro", < 4.5 => "Bem", _ => "Ótimo" };
    }
}
