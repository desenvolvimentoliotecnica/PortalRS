using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoEducacaoResumo : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [StringLength(60)]
    public string? Nivel { get; set; }

    [StringLength(120)]
    public string? AreaPrincipal { get; set; }

    [StringLength(40)]
    public string? Situacao { get; set; }

    /// <summary>Data de conclusão do nível/formação principal (YYYY-MM-DD, como nos itens).</summary>
    [StringLength(20)]
    public string? DataConclusao { get; set; }

    [StringLength(260)]
    public string? Destaques { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CandidatoEducacaoItem : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

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
