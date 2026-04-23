using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Junction Candidato ↔ Vaga — representa cada candidatura enviada pelo candidato.
/// Permite que um mesmo candidato tenha histórico de N candidaturas em vagas diferentes
/// (cenário padrão de ATS / HRIS como Gupy, Greenhouse, Workday).
/// </summary>
public sealed class Candidatura : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public Guid VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    public CandidaturaStatus Status { get; set; } = CandidaturaStatus.Ativa;
    public EtapaMacroCandidatura EtapaMacro { get; set; } = EtapaMacroCandidatura.Aplicada;

    /// <summary>Origem livre ("Site", "LinkedIn", "Indicação"…).</summary>
    [StringLength(60)]
    public string? Fonte { get; set; }

    [StringLength(2000)]
    public string? Observacoes { get; set; }

    public DateTimeOffset AplicadaEmUtc { get; set; }
    public DateTimeOffset? EtapaAtualDesdeUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public List<CandidaturaEtapaHistorico> Historico { get; set; } = new();
}

/// <summary>
/// Linha de histórico de mudança de etapa macro. Permite reconstruir a jornada da candidatura
/// e calcular SLAs por etapa.
/// </summary>
public sealed class CandidaturaEtapaHistorico : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidaturaId { get; set; }
    public Candidatura? Candidatura { get; set; }

    public EtapaMacroCandidatura EtapaAnterior { get; set; }
    public EtapaMacroCandidatura EtapaNova { get; set; }

    [StringLength(2000)]
    public string? Observacao { get; set; }

    public Guid? UserId { get; set; }

    public DateTimeOffset EmUtc { get; set; }
}
