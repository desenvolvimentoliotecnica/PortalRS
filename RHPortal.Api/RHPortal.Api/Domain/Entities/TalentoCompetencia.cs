using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class TalentoCompetencia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TalentoId { get; set; }
    public Talento? Talento { get; set; }

    [Required, StringLength(40)]
    public string Tipo { get; set; } = string.Empty;

    [Required, StringLength(120)]
    public string Nome { get; set; } = string.Empty;

    [Required, StringLength(40)]
    public string Nivel { get; set; } = string.Empty;

    [StringLength(300)]
    public string? Evidencia { get; set; }

    [StringLength(80)]
    public string? TempoAtuacao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
