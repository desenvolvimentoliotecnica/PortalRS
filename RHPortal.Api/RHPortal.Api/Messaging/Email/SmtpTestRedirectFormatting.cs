using System.Net;

namespace RhPortal.Api.Messaging.Email;

/// <summary>
/// Redireciona destinatários quando SMTP está em modo teste (mesma regra do <see cref="EmailQueueService"/>).
/// </summary>
internal static class SmtpTestRedirectFormatting
{
    public static (string To, string Subject, string BodyHtml, string? BodyText) Apply(
        string to,
        string subject,
        string bodyHtml,
        string? bodyText,
        EmailConfigDto? cfg)
    {
        if (cfg is null || !cfg.SmtpUseTestRedirect || string.IsNullOrWhiteSpace(cfg.SmtpTestRedirectAddress))
            return (to, subject, bodyHtml, bodyText);

        var redirect = cfg.SmtpTestRedirectAddress.Trim();
        var originalTo = to.Trim();

        // Idempotência: mensagens vindas da fila já foram redirecionadas pelo Enqueue*;
        // o worker chama SMTP direto e não deve duplicar banner/assunto.
        if (originalTo.Equals(redirect, StringComparison.OrdinalIgnoreCase))
            return (to, subject, bodyHtml, bodyText);
        if (subject.TrimStart().StartsWith("[TEST → era ", StringComparison.Ordinal))
            return (to, subject, bodyHtml, bodyText);
        var prefix = $"[TEST → era {originalTo}] ";
        var banner =
            "<p style=\"color:#666;font-size:12px;margin:0 0 12px 0\"><strong>[Modo teste SMTP]</strong> Destinatário original: <code>" +
            WebUtility.HtmlEncode(originalTo) + "</code></p>";
        var newHtml = banner + bodyHtml;
        var newText = $"[Modo teste SMTP] Destinatário original: {originalTo}\n\n" + (bodyText ?? "");
        return (redirect, prefix + subject.Trim(), newHtml, newText);
    }
}
