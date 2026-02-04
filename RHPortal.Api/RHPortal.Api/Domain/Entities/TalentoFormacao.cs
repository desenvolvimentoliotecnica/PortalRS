using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Formação acadêmica do talento (faculdade, pós, etc.).</summary>
public sealed class TalentoFormacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TalentoId { get; set; }
    public Talento? Talento { get; set; }

    [Required, StringLength(160)]
    public string Curso { get; set; } = string.Empty;

    [StringLength(160)]
    public string? Instituicao { get; set; }

    [StringLength(40)]
    public string? Tipo { get; set; }

    [StringLength(40)]
    public string? Status { get; set; }

    [StringLength(20)]
    public string? Inicio { get; set; }

    [StringLength(20)]
    public string? Fim { get; set; }

    [StringLength(800)]
    public string? Observacoes { get; set; }

    [StringLength(260)]
    public string? Link { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
