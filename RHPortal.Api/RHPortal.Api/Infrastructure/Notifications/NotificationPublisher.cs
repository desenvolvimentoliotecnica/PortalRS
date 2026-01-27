using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Infrastructure.Notifications;

public sealed class NotificationPublisher
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationsHub> _hub;

    public NotificationPublisher(AppDbContext db, IHubContext<NotificationsHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    public async Task<IReadOnlyList<NotificationItem>> PublishToTenantsAsync(
        IReadOnlyList<string> tenantIds,
        NotificationSendRequest request,
        CancellationToken ct)
    {
        if (tenantIds.Count == 0)
            return Array.Empty<NotificationItem>();

        var now = DateTimeOffset.UtcNow;
        var level = string.IsNullOrWhiteSpace(request.Level) ? "info" : request.Level.Trim().ToLowerInvariant();
        var title = request.Title.Trim();
        var message = request.Message.Trim();

        var notifications = tenantIds
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(tenantId => new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Trim(),
                Title = title,
                Message = message,
                Level = level,
                Url = string.IsNullOrWhiteSpace(request.Url) ? null : request.Url.Trim(),
                IsRead = false,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            })
            .ToList();

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync(ct);

        var items = notifications.Select(MapToItem).ToArray();

        foreach (var notification in notifications)
        {
            await _hub.Clients
                .Group(NotificationsHub.GetTenantGroup(notification.TenantId))
                .SendAsync("notification.received", MapToItem(notification), ct);
        }

        return items;
    }

    public async Task<IReadOnlyList<NotificationItem>> PublishToAllTenantsAsync(
        NotificationSendRequest request,
        CancellationToken ct)
    {
        var tenantIds = await _db.Tenants
            .AsNoTracking()
            .Select(t => t.TenantId)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .ToListAsync(ct);

        return await PublishToTenantsAsync(tenantIds.Distinct(StringComparer.OrdinalIgnoreCase).ToList(), request, ct);
    }

    private static NotificationItem MapToItem(Notification notification)
        => new(
            notification.Id,
            notification.Title,
            notification.Message,
            notification.Level,
            notification.CreatedAtUtc,
            notification.Url,
            notification.IsRead
        );
}
