namespace RhPortal.Api.Domain.Entities;

public sealed class Notification
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid? UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Level { get; set; } = "info";
    public string? Url { get; set; }
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
