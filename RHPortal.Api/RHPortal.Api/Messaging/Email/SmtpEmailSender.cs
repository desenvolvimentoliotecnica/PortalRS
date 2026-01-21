using System.Net;
using System.Net.Mail;

namespace RhPortal.Api.Messaging.Email;

public interface IEmailSender
{
    Task SendAsync(EmailSendRequest request, CancellationToken ct);
}

public sealed record EmailSendRequest(
    string To,
    string Subject,
    string BodyHtml,
    string? BodyText,
    string ProviderName
);

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly IEmailConfigService _configService;

    public SmtpEmailSender(IEmailConfigService configService)
    {
        _configService = configService;
    }

    public async Task SendAsync(EmailSendRequest request, CancellationToken ct)
    {
        var config = await _configService.GetDecryptedAsync(ct);
        if (config is null || string.IsNullOrWhiteSpace(config.SmtpHost))
            throw new InvalidOperationException("SMTP not configured.");

        using var client = new SmtpClient(config.SmtpHost, config.SmtpPort)
        {
            EnableSsl = config.SmtpEnableSsl
        };

        if (!string.IsNullOrWhiteSpace(config.SmtpUserName) && !string.IsNullOrWhiteSpace(config.SmtpPassword))
            client.Credentials = new NetworkCredential(config.SmtpUserName, config.SmtpPassword);

        using var msg = new MailMessage
        {
            From = new MailAddress(config.SmtpFromAddress ?? config.SmtpUserName ?? "no-reply@localhost", config.SmtpFromName),
            Subject = request.Subject,
            Body = request.BodyHtml,
            IsBodyHtml = true
        };

        msg.To.Add(request.To);
        await client.SendMailAsync(msg, ct);
    }
}
