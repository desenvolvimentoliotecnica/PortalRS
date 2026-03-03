using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/feedback/items")]
public sealed class FeedbackItemsController : ControllerBase
{
    [RequirePermission("feedback.send")]
    [HttpPost]
    [ProducesResponseType(typeof(FeedbackItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<FeedbackItemResponse>> Create(
        [FromBody] FeedbackCreateRequest request,
        [FromServices] FeedbackService service,
        [FromServices] AwardPointsService awardPoints,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var fromUserId))
            return Unauthorized();

        var created = await service.CreateAsync(request, fromUserId, ct);
        await awardPoints.AwardAsync(
            fromUserId,
            GamificationEventTypes.FeedbackSent,
            sourceId: created.Id.ToString(),
            reason: "Enviar feedback",
            ct);
        await awardPoints.AwardAsync(
            created.ToUserId,
            GamificationEventTypes.FeedbackReceived,
            sourceId: created.Id.ToString(),
            reason: "Receber feedback",
            ct);
        return CreatedAtAction(nameof(ListMine), new { page = 1, pageSize = 20 }, created);
    }

    [RequirePermission("feedback.view")]
    [HttpGet("mine")]
    [ProducesResponseType(typeof(FeedbackListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FeedbackListResponse>> ListMine(
        [FromServices] FeedbackService service,
        CancellationToken ct,
        [FromQuery] string? filter = "all",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await service.ListMineAsync(userId, filter ?? "all", page, pageSize, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.list")]
    [HttpGet("all")]
    [ProducesResponseType(typeof(FeedbackListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<FeedbackListResponse>> ListAll(
        [FromServices] FeedbackService service,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await service.ListAllAsync(page, pageSize, ct);
        return Ok(result);
    }
}
