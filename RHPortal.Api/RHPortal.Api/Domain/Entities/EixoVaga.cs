using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Tipo de vaga — categorização operacional do RH (ex.: ADM e Técnicos, Comercial, Operacional).
/// Define SLA de fechamento em dias úteis e meta de permanência (turnover).
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

    /// <summary>Meta de fechamento em dias úteis (SLA de contratação).</summary>
    public int? SlaDiasMetaFechamento { get; set; }

    /// <summary>Meta de permanência (turnover) em dias corridos. Mutuamente exclusivo com meses e N/A.</summary>
    public int? PermanenciaTurnoverDias { get; set; }

    /// <summary>Meta de permanência (turnover) em meses. Mutuamente exclusivo com dias e N/A.</summary>
    public int? PermanenciaTurnoverMeses { get; set; }

    /// <summary>Quando true, permanência não se aplica (ex.: Operacional).</summary>
    public bool PermanenciaNaoAplica { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public string PermanenciaDisplay => EixoVagaPermanencia.Formatar(
        PermanenciaNaoAplica, PermanenciaTurnoverDias, PermanenciaTurnoverMeses);
}
