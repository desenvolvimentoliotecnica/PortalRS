using System.ComponentModel.DataAnnotations;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

public enum BatchMatchingRunStatus : short
{
    Pending = 0,
    Running = 1,
    Completed = 2,
    Failed = 3,
    Cancelled = 4
}

public sealed class BatchMatchingRun : ITenantEntity
{
    public Guid Id { get; set; }

    [Required, StringLength(64)]
    public string TenantId { get; set; } = default!;

    public BatchMatchingRunStatus Status { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? StartedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }

    public int TotalVagas { get; set; }
    public int ProcessedVagas { get; set; }
    public int FailedVagas { get; set; }
    public int TotalCandidatesScored { get; set; }

    public Guid? LastProcessedVagaId { get; set; }

    [StringLength(2000)]
    public string? LastError { get; set; }

    public ICollection<BatchMatchingRunVaga> Vagas { get; set; } = new List<BatchMatchingRunVaga>();
}

public sealed class BatchMatchingRunVaga
{
    public Guid Id { get; set; }
    public Guid RunId { get; set; }
    public BatchMatchingRun? Run { get; set; }

    public Guid VagaId { get; set; }

    [Required, StringLength(64)]
    public string TenantId { get; set; } = default!;

    public BatchMatchingRunStatus Status { get; set; }
    public int ScoresGenerated { get; set; }
    public DateTimeOffset? StartedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }

    [StringLength(2000)]
    public string? ErrorMessage { get; set; }
}
