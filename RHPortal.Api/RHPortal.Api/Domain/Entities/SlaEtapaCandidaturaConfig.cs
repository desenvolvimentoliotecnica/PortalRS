using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// SLA em dias por etapa macro do funil de candidaturas (kanban).
/// Quando ausente ou inativo, usa o default em <see cref="SlaEtapaDefaults"/>.
/// </summary>
public sealed class SlaEtapaCandidaturaConfig : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public EtapaMacroCandidatura Etapa { get; set; }

    /// <summary>Meta em dias corridos na etapa.</summary>
    public int SlaDias { get; set; }

    public bool Ativo { get; set; } = true;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
