using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class DevelopmentPlan : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid OwnerUserId { get; set; }
    public ApplicationUser? OwnerUser { get; set; }

    /// <summary>Quando preenchido, o plano é do colaborador (gestor cria plano para o colaborador).</summary>
    public Guid? TargetUserId { get; set; }
    public ApplicationUser? TargetUser { get; set; }

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public ICollection<DevelopmentPlanGoal> Goals { get; set; } = new List<DevelopmentPlanGoal>();
}
