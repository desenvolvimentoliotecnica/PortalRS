using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Configuração de SLA por tipo de entidade e status.
/// Define quantas horas uma entidade pode ficar em determinado status antes de violar o SLA.
/// </summary>
public sealed class SlaStatusConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public TipoEntidadeStatus TipoEntidade { get; set; }

    /// <summary>Nome do valor do enum como string (ex: "PendenteAprovacao").</summary>
    [StringLength(80)]
    public string Status { get; set; } = default!;

    /// <summary>Limite em horas para este status. Ex: 48 = 2 dias corridos.</summary>
    public int SlaHoras { get; set; }

    public bool Ativo { get; set; } = true;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
