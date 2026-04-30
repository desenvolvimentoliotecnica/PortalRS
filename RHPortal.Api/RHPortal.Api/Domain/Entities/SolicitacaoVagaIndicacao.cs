using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Indicação / sugestão interna de candidato vinculada a uma solicitação de contratação (SEL‑03).
/// </summary>
public sealed class SolicitacaoVagaIndicacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid SolicitacaoVagaId { get; set; }
    public SolicitacaoVaga? SolicitacaoVaga { get; set; }

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    [MaxLength(2000)]
    public string? Observacao { get; set; }

    public Guid? IndicadoPorUserId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
