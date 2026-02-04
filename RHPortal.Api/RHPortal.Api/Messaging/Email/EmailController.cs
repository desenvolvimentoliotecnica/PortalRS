using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Messaging.Email;

[ApiController]
[Authorize]
[Route("api/emails")]
public sealed class EmailController : ControllerBase
{
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;

    public EmailController(IStringLocalizer<InfrastructureMessages> localizer)
    {
        _localizer = localizer;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<EmailSummaryResponse>> Summary(
        [FromServices] AppDbContext db,
        [FromQuery] string scope = "mine",
        CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var query = db.EmailMessages.AsNoTracking();

        scope = (scope ?? "mine").ToLowerInvariant();
        query = scope switch
        {
            "system" => query.Where(x => x.IsSystem),
            "mine" => query.Where(x => !x.IsSystem && x.OwnerUserId == userId),
            _ => query.Where(x => !x.IsSystem && x.OwnerUserId == userId)
        };

        var todayUtc = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);
        var total = await query.CountAsync(ct);
        var queued = await query.CountAsync(x => x.Status == EmailMessageStatus.Queued || x.Status == EmailMessageStatus.InProgress, ct);
        var failed = await query.CountAsync(x => x.Status == EmailMessageStatus.Failed, ct);
        var sentToday = await query.CountAsync(x => x.Status == EmailMessageStatus.Sent && x.UpdatedAtUtc >= todayUtc, ct);

        return Ok(new EmailSummaryResponse(total, queued, failed, sentToday));
    }

    [HttpGet("messages")]
    public async Task<ActionResult<EmailMessageListResponse>> List(
        [FromServices] AppDbContext db,
        [FromQuery] string scope = "mine",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var query = db.EmailMessages.AsNoTracking();

        scope = (scope ?? "mine").ToLowerInvariant();
        query = scope switch
        {
            "system" => query.Where(x => x.IsSystem),
            "mine" => query.Where(x => !x.IsSystem && x.OwnerUserId == userId),
            _ => query.Where(x => !x.IsSystem && x.OwnerUserId == userId)
        };

        var totalItems = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EmailMessageListItem(
                x.Id,
                x.To,
                x.Subject,
                x.Status,
                x.AttemptCount,
                x.MaxAttempts,
                x.IsSystem,
                x.OwnerUserName,
                x.Source,
                x.CreatedAtUtc,
                x.UpdatedAtUtc))
            .ToListAsync(ct);

        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        return Ok(new EmailMessageListResponse(items, page, pageSize, totalItems, totalPages));
    }

    [HttpGet("messages/{id:guid}")]
    public async Task<ActionResult<EmailMessageDetail>> Get(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var msg = await db.EmailMessages
            .AsNoTracking()
            .Include(x => x.Attempts)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (msg is null) return NotFound();

        if (!msg.IsSystem && msg.OwnerUserId != userId)
            return Forbid();

        var detail = new EmailMessageDetail(
            msg.Id,
            msg.To,
            msg.Subject,
            msg.BodyHtml,
            msg.Status,
            msg.AttemptCount,
            msg.MaxAttempts,
            msg.IsSystem,
            msg.OwnerUserName,
            msg.Source,
            msg.CreatedAtUtc,
            msg.UpdatedAtUtc,
            msg.Attempts
                .OrderByDescending(x => x.StartedAtUtc)
                .Select(a => new EmailAttemptItem(
                    a.Id,
                    a.AttemptNumber,
                    a.Provider,
                    a.StartedAtUtc,
                    a.CompletedAtUtc,
                    a.IsSuccess,
                    a.ErrorMessage))
                .ToList());

        return Ok(detail);
    }

    [HttpPost("messages/{id:guid}/retry")]
    public async Task<IActionResult> Retry(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var msg = await db.EmailMessages.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (msg is null) return NotFound();

        if (!msg.IsSystem && msg.OwnerUserId != userId)
            return Forbid();

        if (msg.Status == EmailMessageStatus.Sent)
            return BadRequest(new { message = _localizer["InfrastructureEmail.EmailAlreadySent"] });

        msg.Status = EmailMessageStatus.Queued;
        msg.NextAttemptAtUtc = DateTimeOffset.UtcNow;
        msg.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok();
    }
}

public sealed record EmailMessageListItem(
    Guid Id,
    string To,
    string Subject,
    EmailMessageStatus Status,
    int AttemptCount,
    int MaxAttempts,
    bool IsSystem,
    string? OwnerUserName,
    string? Source,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record EmailMessageListResponse(
    IReadOnlyList<EmailMessageListItem> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);

public sealed record EmailAttemptItem(
    Guid Id,
    int AttemptNumber,
    string Provider,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    bool IsSuccess,
    string? ErrorMessage);

public sealed record EmailMessageDetail(
    Guid Id,
    string To,
    string Subject,
    string BodyHtml,
    EmailMessageStatus Status,
    int AttemptCount,
    int MaxAttempts,
    bool IsSystem,
    string? OwnerUserName,
    string? Source,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    IReadOnlyList<EmailAttemptItem> Attempts);

public sealed record EmailSummaryResponse(
    int Total,
    int InQueue,
    int Failed,
    int SentToday);
