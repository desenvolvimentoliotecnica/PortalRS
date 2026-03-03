using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Feedback;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

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
        [FromServices] AwardPointsService awardPoints,
        [FromServices] NotificationPublisher publisher,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var authorId))
            return Unauthorized();

        var created = await service.CreateAsync(request, authorId, ct);
        await awardPoints.AwardAsync(
            authorId,
            GamificationEventTypes.CelebrationPost,
            sourceId: created.Id.ToString(),
            reason: "Publicar celebração",
            ct);

        var mentionedUserIds = (created.Mentions ?? Array.Empty<CelebrationMentionResponse>())
            .Select(x => x.UserId)
            .Where(x => x != Guid.Empty && x != authorId)
            .Distinct()
            .ToList();

        if (mentionedUserIds.Count > 0)
        {
            foreach (var mentionedUserId in mentionedUserIds)
            {
                await awardPoints.AwardAsync(
                    mentionedUserId,
                    GamificationEventTypes.CelebrationMentioned,
                    sourceId: $"{created.Id}:{mentionedUserId}",
                    reason: "Ser mencionado em celebração",
                    ct);
            }
            await publisher.PublishToUsersAsync(
                tenantContext.TenantId ?? "",
                mentionedUserIds,
                "Você foi mencionado em uma celebração",
                $"{created.AuthorFullName} mencionou você: \"{Trunc(created.Content, 120)}\"",
                "/Feedback/Celebracao",
                "info",
                ct);
        }
        return CreatedAtAction(nameof(ListFeed), new { page = 1, pageSize = 20 }, created);
    }

    [RequirePermission("feedback.celebracao.view")]
    [HttpGet("feed")]
    [ProducesResponseType(typeof(CelebrationFeedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CelebrationFeedResponse>> ListFeed(
        [FromServices] CelebrationService service,
        CancellationToken ct,
        [FromQuery] string? filter = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized();

        var result = await service.ListFeedAsync(currentUserId, filter, from, to, page, pageSize, ct);
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

    [RequirePermission("feedback.celebracao.view")]
    [HttpGet("{postId:guid}/comments")]
    [ProducesResponseType(typeof(CelebrationCommentsListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CelebrationCommentsListResponse>> ListComments(
        Guid postId,
        [FromServices] CelebrationService service,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized();

        var result = await service.ListCommentsAsync(currentUserId, postId, page, pageSize, ct);
        return Ok(result);
    }

    [RequirePermission("feedback.celebracao.view")]
    [HttpPost("{postId:guid}/comments")]
    [ProducesResponseType(typeof(CelebrationCommentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CelebrationCommentResponse>> CreateComment(
        Guid postId,
        [FromBody] CelebrationCommentCreateRequest request,
        [FromServices] CelebrationService service,
        [FromServices] AwardPointsService awardPoints,
        [FromServices] NotificationPublisher publisher,
        [FromServices] ITenantContext tenantContext,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var authorId))
            return Unauthorized();

        var created = await service.CreateCommentAsync(postId, request, authorId, ct);
        if (created is null)
            return NotFound();
        await awardPoints.AwardAsync(
            authorId,
            GamificationEventTypes.CelebrationComment,
            sourceId: created.Id.ToString(),
            reason: "Comentar em celebração",
            ct);

        var mentionedUserIds = (created.Mentions ?? Array.Empty<CelebrationCommentMentionResponse>())
            .Select(x => x.UserId)
            .Where(x => x != Guid.Empty && x != authorId)
            .Distinct()
            .ToList();

        if (mentionedUserIds.Count > 0)
        {
            foreach (var mentionedUserId in mentionedUserIds)
            {
                await awardPoints.AwardAsync(
                    mentionedUserId,
                    GamificationEventTypes.CelebrationMentioned,
                    sourceId: $"{created.Id}:{mentionedUserId}",
                    reason: "Ser mencionado em comentário",
                    ct);
            }
            await publisher.PublishToUsersAsync(
                tenantContext.TenantId ?? "",
                mentionedUserIds,
                "Você foi mencionado em um comentário",
                $"{created.AuthorFullName} mencionou você em um comentário: \"{Trunc(created.Content, 120)}\"",
                "/Feedback/Celebracao",
                "info",
                ct);
        }
        return CreatedAtAction(nameof(ListComments), new { postId, page = 1, pageSize = 20 }, created);
    }

    [RequirePermission("feedback.celebracao.view")]
    [HttpPost("comments/{commentId:guid}/reactions")]
    [ProducesResponseType(typeof(CelebrationCommentReactionSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CelebrationCommentReactionSummaryResponse>> ToggleCommentReaction(
        Guid commentId,
        [FromBody] CelebrationCommentReactionToggleRequest request,
        [FromServices] CelebrationService service,
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized();

        var result = await service.ToggleCommentReactionAsync(commentId, currentUserId, request.Type, ct);
        if (result is null)
            return NotFound();
        return Ok(result);
    }

    private static string Trunc(string? value, int max)
    {
        var s = (value ?? "").Trim();
        if (s.Length <= max) return s;
        return s[..max].TrimEnd() + "...";
    }
}
