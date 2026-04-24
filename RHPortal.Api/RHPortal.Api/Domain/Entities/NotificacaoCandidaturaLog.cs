using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Auditoria de notificação enviada (ou falhada) a um candidato por mudança de etapa macro.
/// Um envio por canal (Email, WhatsApp) gera uma linha independente.
/// </summary>
public sealed class NotificacaoCandidaturaLog : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidaturaId { get; set; }
    public Guid CandidatoId { get; set; }

    /// <summary>Etapa macro que disparou a notificação (valor final).</summary>
    public EtapaMacroCandidatura EtapaMacro { get; set; }

    /// <summary>Canal usado no envio.</summary>
    public CanalNotificacao Canal { get; set; }

    /// <summary>Resultado final do envio.</summary>
    public NotificacaoStatus Status { get; set; }

    [StringLength(200)]
    public string? Destino { get; set; }

    [StringLength(4000)]
    public string? Mensagem { get; set; }

    [StringLength(1000)]
    public string? ErroMensagem { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
}

public enum CanalNotificacao
{
    Email = 0,
    WhatsApp = 1,
}

public enum NotificacaoStatus
{
    Enviado = 0,
    Falhou = 1,
    IgnoradoSemDestino = 2,
    IgnoradoSemOptIn = 3,
    /// <summary>Pulamos o envio porque o candidato atingiu o rate limit configurado.</summary>
    IgnoradoRateLimit = 4,
    /// <summary>Pulamos o envio porque está dentro da janela de silêncio configurada.</summary>
    IgnoradoSilencio = 5,
    /// <summary>Pulamos o envio porque não há template no idioma do candidato.</summary>
    IgnoradoIdiomaIndisponivel = 6,
}
