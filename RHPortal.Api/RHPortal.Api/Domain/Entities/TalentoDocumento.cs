using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Documento (ex.: PDF do currículo) vinculado ao talento.</summary>
public sealed class TalentoDocumento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TalentoId { get; set; }
    public Talento? Talento { get; set; }

    [Required, StringLength(200)]
    public string NomeArquivo { get; set; } = string.Empty;

    [StringLength(120)]
    public string? ContentType { get; set; }

    [StringLength(240)]
    public string? Descricao { get; set; }

    [StringLength(260)]
    public string? StorageFileName { get; set; }

    public long? TamanhoBytes { get; set; }

    [StringLength(20)]
    public string? DataReferencia { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
