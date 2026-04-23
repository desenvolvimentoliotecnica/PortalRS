using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Messaging.WhatsApp;

/// <summary>
/// Implementação stub que apenas loga a intenção de envio. Mantém a assinatura
/// estável enquanto o provedor real (Twilio, WhatsApp Cloud API) não for configurado.
/// Em produção, substituir a implementação registrada no DI.
/// </summary>
public sealed class LoggingWhatsAppMessageSender : IWhatsAppMessageSender
{
    private readonly ILogger<LoggingWhatsAppMessageSender> _logger;

    public LoggingWhatsAppMessageSender(ILogger<LoggingWhatsAppMessageSender> logger) => _logger = logger;

    public Task<WhatsAppSendResult> SendAsync(string telefoneE164, string mensagem, CancellationToken ct)
    {
        _logger.LogInformation(
            "[WhatsApp stub] destino={Telefone} tamanho={Len} preview={Preview}",
            telefoneE164,
            mensagem.Length,
            mensagem.Length > 120 ? mensagem[..120] + "…" : mensagem);

        return Task.FromResult(new WhatsAppSendResult(Accepted: true, ProviderMessageId: $"stub-{Guid.NewGuid():N}"));
    }
}
