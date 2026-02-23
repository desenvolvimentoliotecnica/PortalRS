namespace RhPortal.Api.Domain.Entities;

public sealed class CelebrationCommentMention
{
    public Guid Id { get; set; }

    public Guid CommentId { get; set; }
    public CelebrationComment? Comment { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }
}

