using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoPreferenciasVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [StringLength(160)]
    public string? CargoAlvo { get; set; }

    [StringLength(60)]
    public string? Senioridade { get; set; }

    [StringLength(60)]
    public string? InicioDisponivel { get; set; }

    [StringLength(1200)]
    public string? Resumo { get; set; }

    [StringLength(240)]
    public string? AreasInteresse { get; set; }

    [StringLength(40)]
    public string? ModeloTrabalho { get; set; }

    [StringLength(40)]
    public string? Jornada { get; set; }

    [StringLength(40)]
    public string? TipoContrato { get; set; }

    [StringLength(40)]
    public string? Viagens { get; set; }

    [StringLength(40)]
    public string? Mudanca { get; set; }

    [StringLength(160)]
    public string? CidadePreferida { get; set; }

    [StringLength(20)]
    public string? DistanciaMaxKm { get; set; }

    [StringLength(200)]
    public string? ObsDeslocamento { get; set; }

    [StringLength(40)]
    public string? PretensaoSalarial { get; set; }

    [StringLength(40)]
    public string? PretensaoNegociavel { get; set; }

    [StringLength(200)]
    public string? BeneficiosDesejados { get; set; }

    [StringLength(200)]
    public string? NaoAbreMaoDe { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
