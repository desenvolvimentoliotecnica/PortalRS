namespace RhPortal.Api.Domain.Entities;

public sealed class AiProviderKey
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string EncryptedKey { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
