using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class TalentoTreinamento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TalentoId { get; set; }
    public Talento? Talento { get; set; }

    [Required, StringLength(160)]
    public string Nome { get; set; } = string.Empty;

    [StringLength(160)]
    public string? Instituicao { get; set; }

    [StringLength(10)]
    public string? Ano { get; set; }

    [StringLength(260)]
    public string? Link { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
