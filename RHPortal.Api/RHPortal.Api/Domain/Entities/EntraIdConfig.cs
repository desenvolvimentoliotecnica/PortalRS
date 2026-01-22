namespace RhPortal.Api.Domain.Entities;

public sealed class EntraIdConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string? EntraTenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecretEncrypted { get; set; }
    public bool IsEnabled { get; set; }
    public string? CallbackPath { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
