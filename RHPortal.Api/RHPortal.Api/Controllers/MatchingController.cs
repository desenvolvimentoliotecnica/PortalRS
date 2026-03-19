using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints de matching candidato x vaga (recalcular score).
/// </summary>
[ApiController]
[Route("api/matching")]
[Authorize]
public sealed class MatchingController : ControllerBase
{
    /// <summary>
    /// Retorna scores de matching para todos os candidatos de um projeto.
    /// Candidatos ainda não pontuados para esta vaga retornam score null.
    /// </summary>
    [HttpGet("scores")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetScores(
        [FromQuery] Guid projetoId,
        [FromQuery] Guid vagaId,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        if (projetoId == Guid.Empty || vagaId == Guid.Empty)
            return BadRequest(new { message = "projetoId e vagaId são obrigatórios." });

        var tenantId = tenantContext.TenantId;

        var candidatoIds = await db.Set<ProjetoCandidato>()
            .AsNoTracking()
            .Where(pc => pc.ProjetoId == projetoId)
            .Select(pc => pc.CandidatoId)
            .ToListAsync(ct);

        if (candidatoIds.Count == 0) return Ok(Array.Empty<object>());

        var scores = await db.Candidatos
            .AsNoTracking()
            .Where(c => candidatoIds.Contains(c.Id) && c.TenantId == tenantId)
            .Select(c => new
            {
                candidatoId = c.Id,
                score = c.LastMatchVagaId == vagaId ? c.LastMatchScore : (int?)null,
            })
            .ToListAsync(ct);

        return Ok(scores);
    }

    /// <summary>
    /// Recalcula o score de matching para um candidato em uma vaga e persiste em LastMatch*.
    /// </summary>
    /// <param name="candidatoId">ID do candidato.</param>
    /// <param name="vagaId">ID da vaga.</param>
    [HttpPost("recalculate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Recalculate(
        [FromQuery] Guid candidatoId,
        [FromQuery] Guid vagaId,
        [FromServices] IMatchingService matchingService,
        CancellationToken ct)
    {
        if (candidatoId == Guid.Empty || vagaId == Guid.Empty)
            return BadRequest(new { message = "candidatoId e vagaId são obrigatórios." });

        await matchingService.CalculateAndStoreAsync(candidatoId, vagaId, ct);
        return NoContent();
    }
}
