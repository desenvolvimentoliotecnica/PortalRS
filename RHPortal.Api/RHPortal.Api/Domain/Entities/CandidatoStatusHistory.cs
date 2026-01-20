using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoStatusHistory : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public CandidatoStatus FromStatus { get; set; }
    public CandidatoStatus ToStatus { get; set; }

    [StringLength(120)]
    public string? Reason { get; set; }

    [StringLength(400)]
    public string? Note { get; set; }

    [StringLength(60)]
    public string? Source { get; set; }

    [StringLength(120)]
    public string? UserId { get; set; }

    [StringLength(200)]
    public string? UserName { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
