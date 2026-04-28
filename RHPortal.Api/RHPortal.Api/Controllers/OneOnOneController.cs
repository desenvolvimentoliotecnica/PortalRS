using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/feedback/oneonone")]
[RequireModule("feedback")]
public sealed class OneOnOneController : ControllerBase
{
    [RequirePermission("feedback.oneonone.view")]
    [HttpPost]
    [ProducesResponseType(typeof(OneOnOneMeetingResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<OneOnOneMeetingResponse>> Create(
        [FromBody] OneOnOneCreateRequest request,
        [FromServices] OneOnOneService service,
        [FromServices] AwardPointsService awardPoints,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var created = await service.CreateAsync(request, userId, ct);
        await awardPoints.AwardAsync(
            userId,
            GamificationEventTypes.OneOnOneCompleted,
            sourceId: created.Id.ToString(),
            reason: "Realizar reunião 1:1",
            ct);
        return CreatedAtAction(nameof(List), new { page = 1, pageSize = 20 }, created);
    }

    [RequirePermission("feedback.oneonone.view")]
    [HttpGet]
    [ProducesResponseType(typeof(OneOnOneListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<OneOnOneListResponse>> List(
        [FromServices] OneOnOneService service,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var result = await service.ListForUserAsync(userId, page, pageSize, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.oneonone.view")]
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(OneOnOneMeetingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OneOnOneMeetingResponse>> GetById(Guid id, [FromServices] OneOnOneService service, CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [RequirePermission("feedback.oneonone.view")]
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(OneOnOneMeetingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OneOnOneMeetingResponse>> Update(Guid id, [FromBody] OneOnOneUpdateRequest request, [FromServices] OneOnOneService service, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var updated = await service.UpdateAsync(id, request, userId, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [RequirePermission("feedback.oneonone.view")]
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, [FromServices] OneOnOneService service, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var deleted = await service.DeleteAsync(id, userId, ct);
        return deleted ? NoContent() : NotFound();
    }

    // ── Templates de Pauta (Entrega 1.2 — Fase 1 Paridade Feedz) ──

    /// <summary>Lista os templates de pauta de 1:1 disponíveis para o tenant.</summary>
    [RequirePermission("feedback.oneonone.view")]
    [HttpGet("templates")]
    [ProducesResponseType(typeof(IReadOnlyList<OneOnOneTemplateResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListarTemplates(
        [FromServices] IOneOnOneTemplateService templateService,
        [FromQuery] bool incluirInativos,
        CancellationToken ct) =>
        Ok(await templateService.ListAsync(incluirInativos, ct));

    /// <summary>Detalhe de um template de pauta (com itens).</summary>
    [RequirePermission("feedback.oneonone.view")]
    [HttpGet("templates/{id:guid}")]
    [ProducesResponseType(typeof(OneOnOneTemplateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTemplate(
        Guid id,
        [FromServices] IOneOnOneTemplateService templateService,
        CancellationToken ct)
    {
        var result = await templateService.GetAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Cria um template de pauta customizado pelo tenant.</summary>
    [RequirePermission("feedback.oneonone.view")]
    [HttpPost("templates")]
    [ProducesResponseType(typeof(OneOnOneTemplateResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CriarTemplate(
        [FromBody] OneOnOneTemplateCreateRequest request,
        [FromServices] IOneOnOneTemplateService templateService,
        CancellationToken ct)
    {
        try
        {
            var result = await templateService.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetTemplate), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
