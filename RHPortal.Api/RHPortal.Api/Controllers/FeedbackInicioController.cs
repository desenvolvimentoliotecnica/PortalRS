using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints agregados do módulo Feedback — KPIs, humor diário e reuniões pendentes.
/// </summary>
[ApiController]
[Route("api/feedback")]
public sealed class FeedbackInicioController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _user;

    public FeedbackInicioController(AppDbContext db, ICurrentUserContext user)
    {
        _db = db;
        _user = user;
    }

    /// <summary>KPIs gerais do módulo Feedback.</summary>
    [HttpGet("inicio/kpis")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> InicioKpis(CancellationToken ct)
    {
        var teamSize = await _db.Users.AsNoTracking().CountAsync(u => u.IsActive, ct);
        var since = DateTimeOffset.UtcNow.AddDays(-30);
        var feedbacks = await _db.FeedbackItems.AsNoTracking().CountAsync(f => f.CreatedAtUtc >= since, ct);
        var meetings = await _db.OneOnOneMeetings.AsNoTracking().CountAsync(m => m.MeetingDate >= since, ct);
        var celebrations = await _db.CelebrationPosts.AsNoTracking().CountAsync(c => c.CreatedAtUtc >= since, ct);
        var plans = await _db.DevelopmentPlans.AsNoTracking().CountAsync(ct);

        var feedbackEff = teamSize > 0 ? Math.Min(100, (int)Math.Round(feedbacks * 100.0 / teamSize)) : 0;
        var oneOnOneEff = teamSize > 0 ? Math.Min(100, (int)Math.Round(meetings * 100.0 / teamSize)) : 0;
        var celebrationEff = teamSize > 0 ? Math.Min(100, (int)Math.Round(celebrations * 100.0 / teamSize)) : 0;
        var devEff = teamSize > 0 ? Math.Min(100, (int)Math.Round(plans * 100.0 / teamSize)) : 0;

        return Ok(new
        {
            teamSize,
            feedbackEfficiency = feedbackEff,
            oneOnOneEfficiency = oneOnOneEff,
            celebrationEfficiency = celebrationEff,
            developmentEfficiency = devEff
        });
    }

    /// <summary>Reuniões 1:1 pendentes/próximas.</summary>
    [HttpGet("meetings/pending")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MeetingsPending([FromQuery] int take = 3, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        var items = await _db.OneOnOneMeetings.AsNoTracking()
            .Include(m => m.Collaborator)
            .Where(m => m.MeetingDate >= DateTimeOffset.UtcNow)
            .OrderBy(m => m.MeetingDate).Take(take)
            .Select(m => new
            {
                id = m.Id.ToString(),
                participantName = m.Collaborator != null ? m.Collaborator.FullName ?? "" : "",
                participantRole = "",
                scheduledAtUtc = m.MeetingDate,
                endAtUtc = m.MeetingDate.AddHours(1)
            })
            .ToListAsync(ct);

        return Ok(new { items, totalItems = items.Count });
    }

    /// <summary>Registra o humor do dia do usuário autenticado.</summary>
    [HttpPost("mood")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PostMood([FromBody] MoodRequest request, CancellationToken ct)
    {
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "very_bad", "bad", "neutral", "good", "great" };
        if (string.IsNullOrWhiteSpace(request?.Mood) || !allowed.Contains(request.Mood))
            return BadRequest(new { message = "Humor inválido. Use: very_bad, bad, neutral, good, great." });

        var userId = _user.UserId ?? Guid.Empty;
        if (userId == Guid.Empty) return BadRequest(new { message = "Usuário não identificado." });

        var today = DateTimeOffset.UtcNow.Date;
        var existing = await _db.MoodEntries
            .FirstOrDefaultAsync(e => e.UserId == userId && e.CreatedAtUtc >= today, ct);

        if (existing != null)
        {
            existing.Mood = request.Mood;
        }
        else
        {
            _db.MoodEntries.Add(new MoodEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Mood = request.Mood,
                Note = request.Note,
                CreatedAtUtc = DateTimeOffset.UtcNow
            });
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

/// <summary>Request para registrar humor.</summary>
public sealed record MoodRequest(string Mood, string? Note);
