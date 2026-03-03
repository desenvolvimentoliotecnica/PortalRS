using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class MoodEntry : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    [Required, MaxLength(20)]
    public string Mood { get; set; } = "neutral";

    [MaxLength(500)]
    public string? Note { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
