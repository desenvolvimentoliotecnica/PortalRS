using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Documento anexado à pré-admissão (upload do candidato ou RH).</summary>
public sealed class PreAdmissaoDocumento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid PreAdmissaoId { get; set; }
    public PreAdmissao? PreAdmissao { get; set; }

    public TipoDocumento Tipo { get; set; }

    [Required, StringLength(260)]
    public string NomeArquivo { get; set; } = string.Empty;

    [StringLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public long TamanhoBytes { get; set; }

    [Required, StringLength(500)]
    public string StoragePath { get; set; } = string.Empty;

    public StatusDocumento Status { get; set; } = StatusDocumento.PendenteValidacao;

    [StringLength(500)]
    public string? ObservacaoRh { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
