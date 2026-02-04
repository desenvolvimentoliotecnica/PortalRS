using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoAcessibilidade : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [StringLength(40)]
    public string? Idioma { get; set; }

    [StringLength(40)]
    public string? Canal { get; set; }

    [StringLength(40)]
    public string? MelhorHorario { get; set; }

    [StringLength(400)]
    public string? ObservacoesComunicacao { get; set; }

    public bool PrecisaLegendas { get; set; }
    public bool PrecisaInterprete { get; set; }
    public bool PrecisaLeitorTela { get; set; }
    public bool PrecisaBaixaEstimulo { get; set; }
    public bool PrecisaMobilidade { get; set; }
    public bool PrecisaTempoExtra { get; set; }

    [StringLength(1200)]
    public string? DetalhesNecessidades { get; set; }

    public bool ConsentimentoPcd { get; set; }

    [StringLength(40)]
    public string? PcdIdentificacao { get; set; }

    [StringLength(60)]
    public string? PcdTipo { get; set; }

    [StringLength(40)]
    public string? PcdComprovacao { get; set; }

    [StringLength(1200)]
    public string? PcdObservacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
