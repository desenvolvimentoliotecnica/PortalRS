using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Eixo da vaga — categorização estratégica definida por tenant (ex.: "Tech", "Comercial",
/// "Operacional"). Permite configurar SLA de fechamento por eixo, sobrepondo o SLA global.
/// </summary>
public sealed class EixoVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [Required, StringLength(30)]
    public string Code { get; set; } = string.Empty;

    [Required, StringLength(120)]
    public string Name { get; set; } = string.Empty;

    [StringLength(400)]
    public string? Description { get; set; }

    /// <summary>Dias alvo para fechamento (SLA). Quando null, usa config global do tenant.</summary>
    public int? SlaDiasMetaFechamento { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
