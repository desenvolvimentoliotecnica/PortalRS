namespace RhPortal.Api.Domain.Entities;

public sealed class CandidatoNotificacaoPreferencia : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid CandidatoId { get; set; }

    public bool CanalEmail { get; set; }
    public bool CanalWhatsapp { get; set; }
    public bool CanalSms { get; set; }
    public bool CanalPush { get; set; }

    public string? Frequencia { get; set; }
    public string? Idioma { get; set; }
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public bool PermiteContato { get; set; }

    public bool AlertaNovasVagas { get; set; }
    public bool AlertaAtualizacoes { get; set; }
    public bool AlertaEntrevistas { get; set; }
    public bool AlertaMensagens { get; set; }
    public bool AlertaDocumentos { get; set; }
    public bool AlertaLembretes { get; set; }

    public string? SilencioAtivo { get; set; }
    public string? SilencioInicio { get; set; }
    public string? SilencioFim { get; set; }
    public string? SilencioPrioridade { get; set; }

    public string? Assinatura { get; set; }

    /// <summary>Override por candidato: máximo de mensagens WhatsApp na janela. Quando null, usa default global.</summary>
    public int? WhatsAppRateLimitMaxMensagens { get; set; }

    /// <summary>Override por candidato: janela do rate limit (minutos). Quando null, usa default global.</summary>
    public int? WhatsAppRateLimitJanelaMinutos { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    public Candidato? Candidato { get; set; }
}
