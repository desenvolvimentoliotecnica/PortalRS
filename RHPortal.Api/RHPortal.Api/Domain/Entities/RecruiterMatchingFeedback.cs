using System.ComponentModel.DataAnnotations;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

public enum RecruiterMatchingAction : short
{
    Viewed = 0,
    Shortlisted = 1,
    InterviewScheduled = 2,
    Offered = 3,
    Hired = 4,
    Rejected = 5
}

public sealed class RecruiterMatchingFeedback : ITenantEntity
{
    public Guid Id { get; set; }

    [Required, StringLength(64)]
    public string TenantId { get; set; } = default!;

    public Guid VagaId { get; set; }
    public Guid CandidatoId { get; set; }

    [StringLength(120)]
    public string? RecruiterUserId { get; set; }

    public RecruiterMatchingAction Action { get; set; }

    /// <summary>Match score at the time the action was taken.</summary>
    public int? MatchScoreAtAction { get; set; }

    /// <summary>Candidate rank position in the matching at the time.</summary>
    public int? RankPositionAtAction { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
