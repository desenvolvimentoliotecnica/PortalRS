using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CelebrationComment : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid PostId { get; set; }
    public CelebrationPost? Post { get; set; }

    public Guid AuthorId { get; set; }
    public ApplicationUser? Author { get; set; }

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public ICollection<CelebrationCommentMention> Mentions { get; set; } = new List<CelebrationCommentMention>();
}

