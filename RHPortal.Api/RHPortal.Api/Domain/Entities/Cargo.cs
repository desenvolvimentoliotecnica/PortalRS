namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Cadastro de Cargos para integração TOTVS.
/// Campos baseados em apisfcargo.p do Protheus.
/// </summary>
public sealed class Cargo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código do cargo no TOTVS (cdn_cargo_basic)</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição do cargo (des_cargo_basic)</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string Description { get; set; } = default!;

    /// <summary>Classificação ocupacional (cod_classific_ocupac)</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string? OccupationalClassification { get; set; }

    /// <summary>Tipo de cargo (cdn_tip_cargo)</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string? CargoType { get; set; }

    /// <summary>Indicador de similaridade (idi_similaridad)</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(1)]
    public string? SimilarityIndicator { get; set; }

    /// <summary>Descrição completa do cargo (dsl_complet_cargo)</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string? FullDescription { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
