namespace RhPortal.Api.Domain.Entities;

public sealed class LocalizationConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string? Culture { get; set; }
    public string? UiCulture { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
