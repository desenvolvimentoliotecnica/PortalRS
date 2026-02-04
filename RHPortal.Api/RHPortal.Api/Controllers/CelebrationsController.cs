using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/feedback/celebrations")]
public sealed class CelebrationsController : ControllerBase
{
    [RequirePermission("feedback.celebracao.view")]
    [HttpPost]
    [ProducesResponseType(typeof(CelebrationPostResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CelebrationPostResponse>> Create(
        [FromBody] CelebrationCreateRequest request,
        [FromServices] CelebrationService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var authorId))
            return Unauthorized();

        var created = await service.CreateAsync(request, authorId, ct);
        return CreatedAtAction(nameof(ListFeed), new { page = 1, pageSize = 20 }, created);
    }

    [RequirePermission("feedback.celebracao.view")]
    [HttpGet("feed")]
    [ProducesResponseType(typeof(CelebrationFeedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CelebrationFeedResponse>> ListFeed(
        [FromServices] CelebrationService service,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await service.ListFeedAsync(page, pageSize, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.celebracao.view")]
    [HttpGet("mention-users")]
    [ProducesResponseType(typeof(IReadOnlyList<CelebrationMentionUserResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CelebrationMentionUserResponse>>> GetMentionUsers(
        [FromServices] CelebrationService service,
        CancellationToken ct,
        [FromQuery] string? q = null,
        [FromQuery] int take = 20)
    {
        var result = await service.GetMentionUsersAsync(q, take, ct);
        return Ok(result);
    }
}
