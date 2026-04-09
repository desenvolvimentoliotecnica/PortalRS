namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Turno (Shift) para integração TOTVS.
/// Baseado em apisfaltturno.p do Protheus (turno_trab table).
/// </summary>
public sealed class Turno : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código do turno</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição do turno</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string Description { get; set; } = default!;

    /// <summary>Hora de início (HH:mm)</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(5)]
    public string? StartTime { get; set; }

    /// <summary>Hora de término (HH:mm)</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(5)]
    public string? EndTime { get; set; }

    /// <summary>Observações</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
