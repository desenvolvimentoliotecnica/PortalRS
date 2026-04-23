using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

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

    public GestaoController(AppDbContext db) => _db = db;

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

    private static string AverageMoodLabel(List<string> moods)
    {
        if (moods.Count == 0) return "—";
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            { ["very_bad"] = 1, ["bad"] = 2, ["neutral"] = 3, ["good"] = 4, ["great"] = 5 };
        var avg = moods.Select(m => map.TryGetValue(m ?? "", out var v) ? v : 3).Average();
        return avg switch { < 1.5 => "Muito mal", < 2.5 => "Mal", < 3.5 => "Neutro", < 4.5 => "Bem", _ => "Ótimo" };
    }
}
