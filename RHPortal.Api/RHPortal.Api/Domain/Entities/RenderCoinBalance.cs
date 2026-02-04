namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// RENDERCOINZ balance per user per tenant.
/// </summary>
public sealed class RenderCoinBalance
{
    public string TenantId { get; set; } = default!;
    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    public decimal Balance { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
