namespace RhPortal.Api.Domain.Entities;

public sealed class AiModel
{
    public Guid Id { get; set; }
    public Guid AiProviderKeyId { get; set; }
    public AiProviderKey? AiProviderKey { get; set; }
    public string ModelId { get; set; } = default!;
    public string DisplayName { get; set; } = default!;
    public bool IsDefault { get; set; }
}
