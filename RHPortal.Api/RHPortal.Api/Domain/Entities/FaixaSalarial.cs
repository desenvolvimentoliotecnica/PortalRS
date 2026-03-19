using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Tabela de referência salarial por estabelecimento e cargo.</summary>
public sealed class FaixaSalarial : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    [StringLength(10)]
    public string? EstabelecimentoCodigo { get; set; }

    public Guid? JobPositionId { get; set; }
    public JobPosition? JobPosition { get; set; }

    public decimal SalarioMinimo { get; set; }
    public decimal SalarioMaximo { get; set; }

    [StringLength(200)]
    public string? Descricao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
