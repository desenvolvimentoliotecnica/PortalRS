namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Unidade de Lotação para integração TOTVS.
/// Baseado em apisfunidlotac.p do Protheus.
/// </summary>
public sealed class UnidadeLotacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Código da unidade de lotação</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(30)]
    public string Code { get; set; } = default!;

    /// <summary>Descrição da unidade de lotação</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string Description { get; set; } = default!;

    /// <summary>Localização física ou código de local</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(120)]
    public string? Location { get; set; }

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
