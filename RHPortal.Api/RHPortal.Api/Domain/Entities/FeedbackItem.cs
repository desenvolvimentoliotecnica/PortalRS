using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class FeedbackItem : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FromUserId { get; set; }
    public ApplicationUser? FromUser { get; set; }

    public Guid ToUserId { get; set; }
    public ApplicationUser? ToUser { get; set; }

    [Required, MaxLength(4000)]
    public string Content { get; set; } = string.Empty;

    [MaxLength(40)]
    public string? Tipo { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
