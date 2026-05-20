using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;

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
    string ProviderName,
    IReadOnlyList<EmailSendAttachment>? Attachments = null
);

public sealed record EmailSendAttachment(
    string FileName,
    string? ContentType,
    byte[] ContentBytes);

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly IEmailConfigService _configService;
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;

    public SmtpEmailSender(
        IEmailConfigService configService,
        IStringLocalizer<InfrastructureMessages> localizer)
    {
        _configService = configService;
        _localizer = localizer;
    }

    public async Task SendAsync(EmailSendRequest request, CancellationToken ct)
    {
        var config = await _configService.GetDecryptedAsync(ct);
        if (config is null || string.IsNullOrWhiteSpace(config.SmtpHost))
            throw new InvalidOperationException(_localizer["InfrastructureEmail.SmtpNotConfigured"]);

        var (to, subject, bodyHtml, _) = SmtpTestRedirectFormatting.Apply(
            request.To, request.Subject, request.BodyHtml, request.BodyText, config);

        using var client = new SmtpClient(config.SmtpHost, config.SmtpPort)
        {
            EnableSsl = config.SmtpEnableSsl
        };

        if (!string.IsNullOrWhiteSpace(config.SmtpUserName) && !string.IsNullOrWhiteSpace(config.SmtpPassword))
            client.Credentials = new NetworkCredential(config.SmtpUserName, config.SmtpPassword);

        using var msg = new MailMessage
        {
            From = new MailAddress(config.SmtpFromAddress ?? config.SmtpUserName ?? "no-reply@localhost", config.SmtpFromName),
            Subject = subject,
            Body = bodyHtml,
            IsBodyHtml = true
        };

        msg.To.Add(to);
        if (request.Attachments is { Count: > 0 })
        {
            foreach (var attachment in request.Attachments)
            {
                if (attachment.ContentBytes.Length == 0)
                    continue;

                var stream = new MemoryStream(attachment.ContentBytes);
                var mailAttachment = new Attachment(
                    stream,
                    attachment.FileName,
                    string.IsNullOrWhiteSpace(attachment.ContentType) ? "application/octet-stream" : attachment.ContentType);
                msg.Attachments.Add(mailAttachment);
            }
        }

        await client.SendMailAsync(msg, ct);
    }
}
