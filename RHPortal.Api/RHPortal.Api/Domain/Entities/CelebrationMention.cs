namespace RhPortal.Api.Domain.Entities;

public sealed class CelebrationMention
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }
    public CelebrationPost? Post { get; set; }

    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }
}
