namespace RhPortal.Api.Contracts.Notifications;

public sealed record NotificationItem(
    Guid Id,
    string Title,
    string Message,
    string Level,
    DateTimeOffset CreatedAt,
    string? Url,
    bool IsRead
);

public sealed record NotificationsListResponse(
    int UnreadCount,
    IReadOnlyList<NotificationItem> Items
);

public enum NotificationScope
{
    Tenant = 0,
    Tenants = 1,
    All = 2
}

public sealed record NotificationSendRequest(
    NotificationScope Scope,
    string Title,
    string Message,
    string? Level,
    string? Url,
    string? TenantId,
    IReadOnlyList<string>? TenantIds
);
