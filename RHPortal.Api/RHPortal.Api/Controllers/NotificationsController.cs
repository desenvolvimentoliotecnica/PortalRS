using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public sealed class NotificationsController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(NotificationsListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<NotificationsListResponse>> List(
        [FromServices] AppDbContext db,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out var parsedUserId))
            return Unauthorized();

        var safeTake = Math.Clamp(take, 1, 100);
        var rawItems = await db.Notifications
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(safeTake)
            .ToListAsync(ct);

        var ids = rawItems.Select(x => x.Id).ToArray();
        var userReceipts = await db.NotificationReceipts
            .AsNoTracking()
            .Where(x => ids.Contains(x.NotificationId) && x.UserId == parsedUserId)
            .ToListAsync(ct);

        var userReceiptMap = userReceipts.ToDictionary(x => x.NotificationId, x => x);
        var receiptCounts = await db.NotificationReceipts
            .AsNoTracking()
            .Where(x => ids.Contains(x.NotificationId))
            .GroupBy(x => x.NotificationId)
            .Select(g => new
            {
                NotificationId = g.Key,
                Seen = g.Count(x => x.SeenAtUtc != null),
                Read = g.Count(x => x.ReadAtUtc != null)
            })
            .ToListAsync(ct);

        var countMap = receiptCounts.ToDictionary(x => x.NotificationId, x => x);
        var items = rawItems.Select(x =>
        {
            var counts = countMap.TryGetValue(x.Id, out var c) ? c : null;
            var receipt = userReceiptMap.TryGetValue(x.Id, out var r) ? r : null;
            return new NotificationItem(
                x.Id,
                x.Title,
                x.Message,
                x.Level,
                x.CreatedAtUtc,
                x.Url,
                receipt?.ReadAtUtc != null,
                counts?.Seen ?? 0,
                counts?.Read ?? 0
            );
        }).ToList();

        var unreadCount = await db.Notifications
            .AsNoTracking()
            .CountAsync(n => !db.NotificationReceipts.Any(r => r.NotificationId == n.Id && r.UserId == parsedUserId && r.ReadAtUtc != null), ct);

        return Ok(new NotificationsListResponse(unreadCount, items));
    }

    [HttpPost]
    public async Task<IActionResult> Send(
        [FromServices] NotificationPublisher publisher,
        [FromServices] ITenantContext tenantContext,
        [FromBody] NotificationSendRequest request,
        CancellationToken ct)
    {
        if (request is null)
            return BadRequest("Payload is required.");

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest("Title and message are required.");

        IReadOnlyList<string> tenantIds = request.Scope switch
        {
            NotificationScope.All => Array.Empty<string>(),
            NotificationScope.Tenants => (request.TenantIds ?? Array.Empty<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray(),
            _ => new[] { string.IsNullOrWhiteSpace(request.TenantId) ? tenantContext.TenantId : request.TenantId.Trim() }
        };

        if (request.Scope == NotificationScope.Tenants && tenantIds.Count == 0)
            return BadRequest("TenantIds is required for scope Tenants.");

        IReadOnlyList<NotificationItem> items;
        if (request.Scope == NotificationScope.All)
        {
            items = await publisher.PublishToAllTenantsAsync(request, ct);
        }
        else
        {
            items = await publisher.PublishToTenantsAsync(tenantIds, request, ct);
        }

        return Ok(new { count = items.Count });
    }

    [HttpPost("{id:guid}/seen")]
    public async Task<IActionResult> MarkSeen(
        [FromServices] AppDbContext db,
        Guid id,
        CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out var parsedUserId))
            return Unauthorized();

        var receipt = await db.NotificationReceipts
            .FirstOrDefaultAsync(x => x.NotificationId == id && x.UserId == parsedUserId, ct);

        if (receipt is null)
        {
            receipt = new Domain.Entities.NotificationReceipt
            {
                Id = Guid.NewGuid(),
                NotificationId = id,
                UserId = parsedUserId,
                SeenAtUtc = DateTimeOffset.UtcNow
            };
            db.NotificationReceipts.Add(receipt);
        }
        else if (receipt.SeenAtUtc is null)
        {
            receipt.SeenAtUtc = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(
        [FromServices] AppDbContext db,
        Guid id,
        CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out var parsedUserId))
            return Unauthorized();

        var receipt = await db.NotificationReceipts
            .FirstOrDefaultAsync(x => x.NotificationId == id && x.UserId == parsedUserId, ct);

        if (receipt is null)
        {
            var now = DateTimeOffset.UtcNow;
            receipt = new Domain.Entities.NotificationReceipt
            {
                Id = Guid.NewGuid(),
                NotificationId = id,
                UserId = parsedUserId,
                SeenAtUtc = now,
                ReadAtUtc = now
            };
            db.NotificationReceipts.Add(receipt);
        }
        else
        {
            var now = DateTimeOffset.UtcNow;
            receipt.SeenAtUtc ??= now;
            receipt.ReadAtUtc ??= now;
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/receipts")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetReceipts(
        [FromServices] AppDbContext db,
        Guid id,
        CancellationToken ct)
    {
        var receipts = await db.NotificationReceipts
            .AsNoTracking()
            .Where(x => x.NotificationId == id)
            .Join(db.Users.AsNoTracking(),
                receipt => receipt.UserId,
                user => user.Id,
                (receipt, user) => new
                {
                    userId = user.Id,
                    name = user.FullName,
                    email = user.Email,
                    seenAt = receipt.SeenAtUtc,
                    readAt = receipt.ReadAtUtc
                })
            .OrderByDescending(x => x.readAt ?? x.seenAt)
            .ToListAsync(ct);

        return Ok(new { items = receipts });
    }
}
