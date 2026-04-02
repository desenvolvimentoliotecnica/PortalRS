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
    string ProviderName
);

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

        using var client = new SmtpClient(config.SmtpHost, config.SmtpPort)
        {
            EnableSsl = config.SmtpEnableSsl
        };

        Console.Error.WriteLine($"[SmtpSender] Host={config.SmtpHost}, Port={config.SmtpPort}, SSL={config.SmtpEnableSsl}, User={config.SmtpUserName}, PwLen={config.SmtpPassword?.Length ?? 0}");
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
