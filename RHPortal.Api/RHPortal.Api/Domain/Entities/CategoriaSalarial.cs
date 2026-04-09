namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Categoria Salarial para integração TOTVS.
/// Baseado em apisfaltcategoria.p do Protheus.
/// </summary>
public sealed class CategoriaSalarial : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código da categoria (1-5 ou A-E)</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(10)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição da categoria</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string Description { get; set; } = default!;

    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
