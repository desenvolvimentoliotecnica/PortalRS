using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/feedback/plans")]
public sealed class DevelopmentPlansController : ControllerBase
{
    [RequirePermission("feedback.myplans.view")]
    [HttpPost]
    [ProducesResponseType(typeof(DevelopmentPlanResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<DevelopmentPlanResponse>> Create(
        [FromBody] DevelopmentPlanCreateRequest request,
        [FromServices] DevelopmentPlanService service,
        [FromServices] AwardPointsService awardPoints,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var created = await service.CreateAsync(request, userId, ct);
        await awardPoints.AwardAsync(
            userId,
            GamificationEventTypes.DevelopmentPlanCreated,
            sourceId: created.Id.ToString(),
            reason: "Criar plano de desenvolvimento",
            ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [RequirePermission("feedback.myplans.view")]
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DevelopmentPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DevelopmentPlanResponse>> GetById(Guid id, [FromServices] DevelopmentPlanService service, CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [RequirePermission("feedback.myplans.view")]
    [HttpGet("my")]
    [ProducesResponseType(typeof(DevelopmentPlanListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DevelopmentPlanListResponse>> ListMy(
        [FromServices] DevelopmentPlanService service,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var result = await service.ListMyAsync(userId, page, pageSize, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.gestao.view")]
    [HttpGet("team")]
    [ProducesResponseType(typeof(DevelopmentPlanListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DevelopmentPlanListResponse>> ListTeam(
        [FromServices] DevelopmentPlanService service,
        CancellationToken ct,
        [FromQuery] Guid? targetUserId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var result = await service.ListForTeamAsync(userId, targetUserId, page, pageSize, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.myplans.view")]
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(DevelopmentPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DevelopmentPlanResponse>> Update(Guid id, [FromBody] DevelopmentPlanUpdateRequest request, [FromServices] DevelopmentPlanService service, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var updated = await service.UpdateAsync(id, request, userId, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [RequirePermission("feedback.myplans.view")]
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, [FromServices] DevelopmentPlanService service, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var deleted = await service.DeleteAsync(id, userId, ct);
        return deleted ? NoContent() : NotFound();
    }

    [RequirePermission("feedback.myplans.view")]
    [HttpPost("{planId:guid}/goals")]
    [ProducesResponseType(typeof(DevelopmentPlanGoalResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DevelopmentPlanGoalResponse>> AddGoal(Guid planId, [FromBody] DevelopmentPlanGoalCreateRequest request, [FromServices] DevelopmentPlanService service, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var goal = await service.AddGoalAsync(planId, request, userId, ct);
        return goal is null ? NotFound() : CreatedAtAction(nameof(GetById), new { id = planId }, goal);
    }

    [RequirePermission("feedback.myplans.view")]
    [HttpPut("{planId:guid}/goals/{goalId:guid}")]
    [ProducesResponseType(typeof(DevelopmentPlanGoalResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DevelopmentPlanGoalResponse>> UpdateGoal(Guid planId, Guid goalId, [FromBody] DevelopmentPlanGoalUpdateRequest request, [FromServices] DevelopmentPlanService service, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var goal = await service.UpdateGoalAsync(planId, goalId, request, userId, ct);
        return goal is null ? NotFound() : Ok(goal);
    }

    [RequirePermission("feedback.myplans.view")]
    [HttpDelete("{planId:guid}/goals/{goalId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteGoal(Guid planId, Guid goalId, [FromServices] DevelopmentPlanService service, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();
        var deleted = await service.DeleteGoalAsync(planId, goalId, userId, ct);
        return deleted ? NoContent() : NotFound();
    }
}
