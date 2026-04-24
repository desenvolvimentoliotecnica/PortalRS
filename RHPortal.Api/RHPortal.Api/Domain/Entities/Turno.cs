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

    /// <summary>
    /// Unidade de lotação à qual o turno pertence. Null = turno global do tenant
    /// (compatibilidade retroativa com registros anteriores ao épico "Turnos por unidade").
    /// Quando preenchido, indica que o turno só é válido para aquela unidade — usado por
    /// triagem, escala e alocação de vaga.
    /// </summary>
    public Guid? UnidadeLotacaoId { get; set; }
    public UnidadeLotacao? UnidadeLotacao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
