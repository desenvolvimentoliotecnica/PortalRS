using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints de Desempenho (avaliações do colaborador autenticado).
/// </summary>
[ApiController]
[Route("api/desempenho")]
public sealed class DesempenhoController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserContext _user;

    public DesempenhoController(AppDbContext db, ICurrentUserContext user)
    {
        _db = db;
        _user = user;
    }

    /// <summary>Avaliações do usuário autenticado.</summary>
    [HttpGet("minhas-avaliacoes")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MinhasAvaliacoes(CancellationToken ct)
    {
        var userId = _user.UserId ?? Guid.Empty;

        var plans = await _db.DevelopmentPlans.AsNoTracking()
            .Include(p => p.Goals)
            .Where(p => p.OwnerUserId == userId || p.TargetUserId == userId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(ct);

        var result = plans.Select(p =>
        {
            var total = p.Goals?.Count ?? 0;
            var done = p.Goals?.Count(g => g.ConcludedAt != null) ?? 0;
            var progress = total > 0 ? (int)Math.Round(done * 100.0 / total) : 0;
            var status = done == total && total > 0 ? "completed"
                : p.Goals?.Any(g => g.ConcludedAt == null && g.DueDate.HasValue && g.DueDate < DateTimeOffset.UtcNow) == true ? "expired"
                : total > 0 ? "in_progress" : "pending";

            return new
            {
                id = p.Id.ToString(),
                title = p.Title,
                cycle = p.CreatedAtUtc.Year.ToString(),
                status,
                score = progress > 0 ? (int?)progress : null,
                dueDate = p.Goals?.Where(g => g.DueDate.HasValue).OrderByDescending(g => g.DueDate).FirstOrDefault()?.DueDate?.ToString("yyyy-MM-dd") ?? "",
                completedAtUtc = done == total && total > 0 ? p.UpdatedAtUtc.ToString("o") : (string?)null
            };
        });

        return Ok(result);
    }
}
