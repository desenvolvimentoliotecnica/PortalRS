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
}
