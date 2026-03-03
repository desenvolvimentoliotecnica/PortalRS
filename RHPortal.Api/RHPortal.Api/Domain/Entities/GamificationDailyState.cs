namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Tracks daily login streak and activity counters per user.
/// </summary>
public sealed class GamificationDailyState : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;
    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    public int CurrentStreak { get; set; }
    public int BestStreak { get; set; }
    public DateOnly? LastCheckInDate { get; set; }
    public DateOnly? LastActivityDate { get; set; }

    public int FeedbackSentToday { get; set; }
    public int CelebrationPostsToday { get; set; }
    public int CelebrationCommentsToday { get; set; }
    public int OneOnOneCompletedToday { get; set; }
    public int DevelopmentPlansCreatedToday { get; set; }
    public int SurveyAnsweredToday { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
