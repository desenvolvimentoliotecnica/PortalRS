using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CelebrationCommentReaction
{
    public Guid Id { get; set; }

    public Guid CommentId { get; set; }
    public CelebrationComment? Comment { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    [Required, MaxLength(20)]
    public string Type { get; set; } = "like";

    public DateTimeOffset CreatedAtUtc { get; set; }
}

