namespace RhPortal.Api.Messaging.WhatsApp;

/// <summary>
/// Abstração para envio de mensagens WhatsApp. A implementação default é
/// <see cref="LoggingWhatsAppMessageSender"/> (stub que apenas loga). Em produção,
/// plugar um provedor real (Twilio, WhatsApp Cloud API, ou a mesma API do Ítalo).
/// </summary>
public interface IWhatsAppMessageSender
{
    /// <summary>
    /// Envia <paramref name="mensagem"/> para o telefone no formato E.164 (ex.: +5511987654321).
    /// Retorna <c>true</c> quando aceito pelo provedor; <c>false</c> se o destinatário for inválido
    /// ou o provedor recusar. Exceções indicam falha transiente do provedor.
    /// </summary>
    Task<WhatsAppSendResult> SendAsync(string telefoneE164, string mensagem, CancellationToken ct);
}

public sealed record WhatsAppSendResult(bool Accepted, string? ProviderMessageId = null, string? ErrorMessage = null);
