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
