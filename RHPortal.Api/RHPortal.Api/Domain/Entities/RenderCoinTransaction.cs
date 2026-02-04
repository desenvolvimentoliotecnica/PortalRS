using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// RENDERCOINZ transaction (credit/debit) for a user.
/// </summary>
public sealed class RenderCoinTransaction
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    /// <summary>Positive = credit, negative = debit.</summary>
    public decimal Amount { get; set; }

    [MaxLength(200)]
    public string? Reason { get; set; }

    [MaxLength(40)]
    public string? SourceType { get; set; }

    [MaxLength(100)]
    public string? SourceId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
