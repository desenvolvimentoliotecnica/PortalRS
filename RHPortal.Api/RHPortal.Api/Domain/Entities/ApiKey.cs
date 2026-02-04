namespace RhPortal.Api.Domain.Entities;

public sealed class ApiKey : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string Name { get; set; } = default!;
    /// <summary>SHA256 hash of the key (key is only shown once on create).</summary>
    public string KeyHash { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? LastUsedAtUtc { get; set; }
}
