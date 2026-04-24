using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Template editável de notificação por (etapa × canal × idioma) usado em
/// <c>CandidaturaNotificacaoService</c>. Quando há um registro para a combinação,
/// ele sobrescreve o default hardcoded. Placeholders aceitos no corpo/assunto:
///   <c>{candidatoNome}</c>, <c>{vagaTitulo}</c>.
/// Unicidade garantida por índice único em (TenantId, Etapa, Canal, Idioma) — Idioma
/// nulo representa o template "default por canal" (qualquer idioma sem variante específica).
/// </summary>
public sealed class NotificacaoTemplate : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public EtapaMacroCandidatura Etapa { get; set; }

    public CanalNotificacao Canal { get; set; }

    /// <summary>
    /// Idioma alvo (BCP-47, ex.: "pt-BR", "en-US"). Quando null, é o template default
    /// que se aplica a qualquer idioma sem variante específica.
    /// </summary>
    [StringLength(10)]
    public string? Idioma { get; set; }

    /// <summary>Assunto (opcional — WhatsApp não usa). Suporta placeholders.</summary>
    [StringLength(240)]
    public string? Assunto { get; set; }

    /// <summary>Corpo do template. Obrigatório. Suporta placeholders.</summary>
    [Required]
    [StringLength(4000)]
    public string Corpo { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
