using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Domain.Entities;

public sealed class NotificationReceipt : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid NotificationId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset? SeenAtUtc { get; set; }
    public DateTimeOffset? ReadAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
