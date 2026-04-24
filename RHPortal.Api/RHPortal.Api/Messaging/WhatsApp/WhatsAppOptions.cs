namespace RhPortal.Api.Messaging.WhatsApp;

/// <summary>
/// Configurações default por tenant para envio de WhatsApp. Cada candidato pode
/// ter overrides em <see cref="Domain.Entities.CandidatoNotificacaoPreferencia"/>.
/// </summary>
public sealed class WhatsAppOptions
{
    public const string SectionName = "WhatsApp";

    /// <summary>Máximo de mensagens por candidato dentro da janela. Default: 5.</summary>
    public int RateLimitMaxMensagens { get; set; } = 5;

    /// <summary>Janela do rate limit em minutos. Default: 60 (uma hora).</summary>
    public int RateLimitJanelaMinutos { get; set; } = 60;

    /// <summary>Quando true, respeita janela de silêncio configurada na preferência do candidato.</summary>
    public bool RespeitarSilencio { get; set; } = true;

    /// <summary>Idioma default usado quando a preferência do candidato não definir nada.</summary>
    public string IdiomaDefault { get; set; } = "pt-BR";

    /// <summary>
    /// Provedor ativo: "Logging" (stub default), "Twilio" (REST API),
    /// "MetaCloud" (WhatsApp Cloud API). Resolução dos credenciais via subseção.
    /// </summary>
    public string Provider { get; set; } = "Logging";

    public TwilioOptions Twilio { get; set; } = new();
    public MetaCloudOptions MetaCloud { get; set; } = new();
}

public sealed class TwilioOptions
{
    /// <summary>Account SID Twilio (ex.: ACxxxxx).</summary>
    public string AccountSid { get; set; } = "";

    /// <summary>Auth Token Twilio.</summary>
    public string AuthToken { get; set; } = "";

    /// <summary>Número WhatsApp habilitado no Twilio (ex.: "whatsapp:+14155238886").</summary>
    public string FromNumber { get; set; } = "";

    /// <summary>Endpoint REST base — sobrescritável em testes / sandbox.</summary>
    public string BaseUrl { get; set; } = "https://api.twilio.com";
}

public sealed class MetaCloudOptions
{
    /// <summary>WhatsApp Business Account → Phone Number ID.</summary>
    public string PhoneNumberId { get; set; } = "";

    /// <summary>Access token de longa duração (System User token).</summary>
    public string AccessToken { get; set; } = "";

    /// <summary>Versão da API Graph (ex.: "v18.0").</summary>
    public string GraphVersion { get; set; } = "v18.0";

    /// <summary>Endpoint base — sobrescritável em testes / sandbox.</summary>
    public string BaseUrl { get; set; } = "https://graph.facebook.com";
}
