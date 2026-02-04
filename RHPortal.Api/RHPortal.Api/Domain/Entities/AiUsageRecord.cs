namespace RhPortal.Api.Domain.Entities;

public sealed class AiUsageRecord
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public string Module { get; set; } = default!;
    public Guid AiModelId { get; set; }
    public AiModel? AiModel { get; set; }
    public decimal Cost { get; set; }
    public string? ActionDescription { get; set; }
    public string? RequestMessage { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
