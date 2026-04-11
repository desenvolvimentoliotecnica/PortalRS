namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Centro de Custo para integração TOTVS.
/// Baseado em apisfaltccusto.p do Protheus.
/// </summary>
public sealed class CentroCusto : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código do centro de custo (max 30 caracteres)</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição do centro de custo</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string Description { get; set; } = default!;

    /// <summary>Gerente ou responsável</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string? Manager { get; set; }

    /// <summary>Observações</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(500)]
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Data de início da vigência (opcional)</summary>
    public DateOnly? ValidFrom { get; set; }

    /// <summary>Data de fim da vigência. Se menor que hoje, o CC é tratado como inativo no lookup.</summary>
    public DateOnly? ValidUntil { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public bool IsExpired => ValidUntil.HasValue && ValidUntil.Value < DateOnly.FromDateTime(DateTime.UtcNow);

    public Guid? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }
}
