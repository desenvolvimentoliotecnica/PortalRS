using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints de matching candidato x vaga (recalcular score).
/// </summary>
[ApiController]
[Route("api/matching")]
[Authorize]
[RequireModule("matching")]
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

    /// <summary>
    /// Inicia um batch matching run para todas as vagas ativas (ou uma lista específica).
    /// </summary>
    [HttpPost("batch/start")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> StartBatchRun(
        [FromBody] StartBatchRunRequest? request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        [FromServices] BatchMatchingQueue queue)
    {
        var tenantId = tenantContext.TenantId ?? "";
        var runId = Guid.NewGuid();
        var maxPerVaga = request?.MaxCandidatesPerVaga ?? 100;

        var run = new BatchMatchingRun
        {
            Id = runId,
            TenantId = tenantId,
            Status = BatchMatchingRunStatus.Pending,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<BatchMatchingRun>().Add(run);
        await db.SaveChangesAsync();

        queue.Writer.TryWrite(new BatchMatchingRequest(
            runId, tenantId, request?.VagaIds, maxPerVaga));

        return Accepted(new { runId, status = "pending" });
    }

    /// <summary>
    /// Retorna o status de um batch matching run.
    /// </summary>
    [HttpGet("batch/status/{runId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBatchRunStatus(
        Guid runId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var run = await db.Set<BatchMatchingRun>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == runId, ct);
        if (run is null) return NotFound();

        return Ok(new
        {
            run.Id,
            status = run.Status.ToString(),
            run.TotalVagas,
            run.ProcessedVagas,
            run.FailedVagas,
            run.TotalCandidatesScored,
            run.StartedAtUtc,
            run.CompletedAtUtc,
            run.LastError,
            progressPercent = run.TotalVagas > 0
                ? Math.Round((double)run.ProcessedVagas / run.TotalVagas * 100, 1)
                : 0,
        });
    }

    /// <summary>
    /// Lista os batch matching runs recentes.
    /// </summary>
    [HttpGet("batch/runs")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListBatchRuns(
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var runs = await db.Set<BatchMatchingRun>()
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(20)
            .Select(x => new
            {
                x.Id,
                status = x.Status.ToString(),
                x.TotalVagas,
                x.ProcessedVagas,
                x.FailedVagas,
                x.TotalCandidatesScored,
                x.CreatedAtUtc,
                x.CompletedAtUtc,
            })
            .ToListAsync(ct);
        return Ok(runs);
    }

    /// <summary>
    /// Registra feedback de ação do recrutador sobre um candidato na vaga.
    /// </summary>
    [HttpPost("feedback")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RecordFeedback(
        [FromBody] RecordFeedbackRequest request,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext)
    {
        var tenantId = tenantContext.TenantId ?? "";
        db.Set<RecruiterMatchingFeedback>().Add(new RecruiterMatchingFeedback
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            VagaId = request.VagaId,
            CandidatoId = request.CandidatoId,
            RecruiterUserId = request.RecruiterUserId,
            Action = request.Action,
            MatchScoreAtAction = request.MatchScoreAtAction,
            RankPositionAtAction = request.RankPositionAtAction,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Retorna o NDCG@10 para uma vaga específica.
    /// </summary>
    [HttpGet("ndcg")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNdcg(
        [FromQuery] Guid vagaId,
        [FromServices] INdcgCalculationService ndcgService,
        CancellationToken ct)
    {
        var ndcg = await ndcgService.CalculateNdcgForVagaAsync(vagaId, 10, ct);
        return Ok(new { vagaId, ndcg10 = ndcg });
    }

    /// <summary>
    /// Retorna o NDCG médio das últimas vagas (KPI de qualidade do matching).
    /// </summary>
    [HttpGet("ndcg/summary")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNdcgSummary(
        [FromServices] INdcgCalculationService ndcgService,
        CancellationToken ct)
    {
        var avgNdcg = await ndcgService.GetAverageNdcgAsync(50, ct);
        return Ok(new { averageNdcg10 = avgNdcg, target = 0.6 });
    }
}

public sealed record StartBatchRunRequest(
    List<Guid>? VagaIds = null,
    int MaxCandidatesPerVaga = 100);

public sealed record RecordFeedbackRequest(
    Guid VagaId,
    Guid CandidatoId,
    RecruiterMatchingAction Action,
    string? RecruiterUserId = null,
    int? MatchScoreAtAction = null,
    int? RankPositionAtAction = null);
