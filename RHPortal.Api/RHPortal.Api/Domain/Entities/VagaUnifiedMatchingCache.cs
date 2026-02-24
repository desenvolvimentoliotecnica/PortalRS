using System.ComponentModel.DataAnnotations;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

public enum UnifiedMatchingCacheStatus
{
    Processing = 0,
    Ready = 1,
    Failed = 2,
}

/// <summary>
/// Cache persistido do ranking unificado (candidatos + talentos) por vaga, calculado via RHPortal.Ai.
/// </summary>
public sealed class VagaUnifiedMatchingCache : ITenantEntity
{
    public Guid VagaId { get; set; }
    public Vaga? Vaga { get; set; }

    [Required, StringLength(64)]
    public string TenantId { get; set; } = default!;

    /// <summary>Hash do MatchingFiltrosRaw vigente no último cálculo bem-sucedido.</summary>
    [Required, StringLength(64)]
    public string CurrentFiltersHash { get; set; } = string.Empty;

    /// <summary>Hash do MatchingFiltrosRaw que está sendo calculado (quando Status=Processing).</summary>
    [StringLength(64)]
    public string? PendingFiltersHash { get; set; }

    public UnifiedMatchingCacheStatus Status { get; set; } = UnifiedMatchingCacheStatus.Processing;

    public DateTimeOffset? StartedAtUtc { get; set; }
    public DateTimeOffset? ComputedAtUtc { get; set; }
    public DateTimeOffset? LastAccessAtUtc { get; set; }

    /// <summary>JSON do array de itens (MatchingCandidateItemResponse) retornado pela IA.</summary>
    public string? ItemsJson { get; set; }

    [StringLength(2000)]
    public string? LastError { get; set; }
}

