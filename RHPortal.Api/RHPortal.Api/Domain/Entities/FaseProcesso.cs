using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Fase do processo seletivo dentro de um ProjetoVaga. Dinâmica e reordenável por CRUD.
/// Exemplos: "Triagem", "Entrevista RH", "Teste Técnico", "Entrevista Gestor", "Oferta".
/// </summary>
public sealed class FaseProcesso : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid ProjetoId { get; set; }
    public ProjetoVaga? Projeto { get; set; }

    [Required, MaxLength(160)]
    public string Nome { get; set; } = string.Empty;

    /// <summary>Ordem de exibição (0 = primeira fase).</summary>
    public int Ordem { get; set; }

    /// <summary>Quem conduz esta fase.</summary>
    public ResponsavelFaseTipo ResponsavelTipo { get; set; } = ResponsavelFaseTipo.RH;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
