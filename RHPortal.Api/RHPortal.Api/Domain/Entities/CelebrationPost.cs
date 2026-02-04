using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CelebrationPost : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid AuthorId { get; set; }
    public ApplicationUser? Author { get; set; }

    [Required, MaxLength(4000)]
    public string Content { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public ICollection<CelebrationMention> Mentions { get; set; } = new List<CelebrationMention>();
}
