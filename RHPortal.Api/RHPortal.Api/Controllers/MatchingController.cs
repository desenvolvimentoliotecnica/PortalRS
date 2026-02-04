using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Matching;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints de matching candidato x vaga (recalcular score).
/// </summary>
[ApiController]
[Route("api/matching")]
public sealed class MatchingController : ControllerBase
{
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
