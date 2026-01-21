using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

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
    private readonly EmailOptions _options;

    public SmtpEmailSender(IOptions<EmailOptions> options)
    {
        _options = options.Value;
    }

    public async Task SendAsync(EmailSendRequest request, CancellationToken ct)
    {
        var provider = (_options.Provider ?? "smtp").Trim().ToLowerInvariant();
        var settings = provider == "ses" ? _options.Ses : _options.Smtp;

        if (string.IsNullOrWhiteSpace(settings.Host))
            throw new InvalidOperationException("SMTP host not configured.");

        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = settings.EnableSsl,
            Credentials = new NetworkCredential(settings.UserName, settings.Password)
        };

        using var msg = new MailMessage
        {
            From = new MailAddress(settings.FromAddress, settings.FromName),
            Subject = request.Subject,
            Body = request.BodyHtml,
            IsBodyHtml = true
        };

        msg.To.Add(request.To);
        await client.SendMailAsync(msg, ct);
    }
}
