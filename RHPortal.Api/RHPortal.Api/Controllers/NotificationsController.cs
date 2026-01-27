using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        var safeTake = Math.Clamp(take, 1, 100);
        var items = await db.Notifications
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(safeTake)
            .Select(x => new NotificationItem(
                x.Id,
                x.Title,
                x.Message,
                x.Level,
                x.CreatedAtUtc,
                x.Url,
                x.IsRead
            ))
            .ToListAsync(ct);

        var unreadCount = await db.Notifications
            .AsNoTracking()
            .CountAsync(x => !x.IsRead, ct);

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
}
