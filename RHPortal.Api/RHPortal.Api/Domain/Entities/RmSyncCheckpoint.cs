using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Watermark de sincronização incremental por tabela RM (PFUNC, PPESSOA, VRSVAGAS, etc.).
/// Persiste o <c>MAX(RECMODIFIEDON)</c> observado no último ciclo bem-sucedido —
/// o worker usa isso como filtro <c>WHERE RECMODIFIEDON &gt; @lastWatermark</c> no próximo ciclo.
/// Null = primeiro run (força full sync na tabela).
/// </summary>
public sealed class RmSyncCheckpoint : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Nome canônico da tabela RM (ex.: "PFUNC", "PPESSOA", "VRSVAGAS"). Único por tenant.</summary>
    [MaxLength(60)]
    public string Entidade { get; set; } = default!;

    /// <summary>Maior <c>RECMODIFIEDON</c> aplicado com sucesso. Null = nunca rodou ou foi resetado.</summary>
    public DateTime? LastRecModifiedOn { get; set; }

    public DateTimeOffset? LastRunAtUtc { get; set; }

    /// <summary>Status do último ciclo: "Sucesso" | "Falha" | "FalhaParcial".</summary>
    [MaxLength(20)]
    public string? LastRunStatus { get; set; }

    /// <summary>Anotações livres (ex.: "full forçado em DD/MM por bug X"). Útil pra auditoria.</summary>
    [MaxLength(500)]
    public string? Notes { get; set; }
}
