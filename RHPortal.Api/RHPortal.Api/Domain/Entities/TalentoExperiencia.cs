using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class TalentoExperiencia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid TalentoId { get; set; }
    public Talento? Talento { get; set; }

    [Required, StringLength(160)]
    public string Empresa { get; set; } = string.Empty;

    [Required, StringLength(160)]
    public string Cargo { get; set; } = string.Empty;

    [StringLength(20)]
    public string? Inicio { get; set; }

    [StringLength(20)]
    public string? Fim { get; set; }

    [StringLength(40)]
    public string? TipoContratacao { get; set; }

    [StringLength(160)]
    public string? Local { get; set; }

    [StringLength(2400)]
    public string? Atividades { get; set; }

    [StringLength(800)]
    public string? ResumoAtividades { get; set; }

    [StringLength(40)]
    public string? NivelSenioridade { get; set; }

    [StringLength(80)]
    public string? NivelHierarquico { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
