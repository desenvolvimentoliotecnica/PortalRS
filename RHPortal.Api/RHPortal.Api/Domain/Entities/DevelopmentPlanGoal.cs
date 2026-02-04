using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class DevelopmentPlanGoal
{
    public Guid Id { get; set; }

    public Guid PlanId { get; set; }
    public DevelopmentPlan? Plan { get; set; }

    [Required, MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public DateTimeOffset? DueDate { get; set; }
    public DateTimeOffset? ConcludedAt { get; set; }
    public int Order { get; set; }
}
