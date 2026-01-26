using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoReferencia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [Required, StringLength(160)]
    public string Nome { get; set; } = string.Empty;

    [StringLength(80)]
    public string? Relacao { get; set; }

    [StringLength(160)]
    public string? Empresa { get; set; }

    [StringLength(120)]
    public string? Cargo { get; set; }

    [StringLength(220)]
    public string? Contato { get; set; }

    [StringLength(60)]
    public string? Periodo { get; set; }

    [StringLength(260)]
    public string? Linkedin { get; set; }

    [StringLength(1200)]
    public string? Observacoes { get; set; }

    public bool PodeContatar { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
