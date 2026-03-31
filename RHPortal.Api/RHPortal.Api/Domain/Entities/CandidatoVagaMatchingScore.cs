using System.ComponentModel.DataAnnotations;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Score de matching por IA para um par (candidato, vaga). Persistido quando o candidato se candidata ou é atribuído à vaga.
/// </summary>
public sealed class CandidatoVagaMatchingScore : ITenantEntity
{
    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public Guid VagaId { get; set; }
    public Vaga? Vaga { get; set; }

    /// <summary>Score 0-100 (por critérios da vaga).</summary>
    public int Score { get; set; }

    public int? ScoreCompetencia { get; set; }
    public int? ScoreExperiencia { get; set; }
    public int? ScoreFormacao { get; set; }
    public int? ScoreLocalidade { get; set; }

    [StringLength(20)]
    public string? Source { get; set; }

    [StringLength(2000)]
    public string? Justificativa { get; set; }

    [StringLength(30)]
    public string? RuleVersion { get; set; }

    public DateTimeOffset CalculatedAtUtc { get; set; }

    [Required, StringLength(64)]
    public string TenantId { get; set; } = default!;
}
