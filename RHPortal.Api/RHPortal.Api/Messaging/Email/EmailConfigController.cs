using System.Net;
using System.Net.Mail;
using MailKit.Net.Imap;
using MailKit.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Messaging.Email;

[ApiController]
[Authorize]
[Route("api/email-config")]
public sealed class EmailConfigController : ControllerBase
{
    private readonly IEmailConfigService _service;

    public EmailConfigController(IEmailConfigService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<EmailConfigView>> Get(CancellationToken ct)
    {
        var data = await _service.GetAsync(ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpPut]
    public async Task<ActionResult<EmailConfigView>> Save([FromBody] EmailConfigDto dto, CancellationToken ct)
    {
        var data = await _service.SaveAsync(dto, ct);
        return Ok(data);
    }

    [HttpPost("test-smtp")]
    public async Task<IActionResult> TestSmtp([FromBody] EmailTestRequest request, CancellationToken ct)
    {
        var config = await _service.GetDecryptedAsync(ct);
        if (config is null)
            return BadRequest(new { message = "SMTP nao configurado." });

        var host = request.SmtpHost ?? config.SmtpHost;
        var port = request.SmtpPort ?? config.SmtpPort;
        var enableSsl = request.SmtpEnableSsl ?? config.SmtpEnableSsl;
        var user = request.SmtpUserName ?? config.SmtpUserName;
        var pass = string.IsNullOrWhiteSpace(request.SmtpPassword) ? config.SmtpPassword : request.SmtpPassword;
        var fromAddress = request.FromAddress ?? config.SmtpFromAddress ?? user;
        var fromName = request.FromName ?? config.SmtpFromName ?? "Portal RH";
        var to = request.TestTo ?? fromAddress;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress) || string.IsNullOrWhiteSpace(to))
            return BadRequest(new { message = "Dados insuficientes para teste SMTP." });

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl
        };

        if (!string.IsNullOrWhiteSpace(user) && !string.IsNullOrWhiteSpace(pass))
            client.Credentials = new NetworkCredential(user, pass);

        using var msg = new MailMessage
        {
            From = new MailAddress(fromAddress, fromName),
            Subject = "Teste SMTP - Portal RH",
            Body = "Teste de conexao SMTP realizado com sucesso.",
            IsBodyHtml = false
        };
        msg.To.Add(to);

        await client.SendMailAsync(msg, ct);
        return Ok(new { message = "SMTP OK" });
    }

    [HttpPost("test-imap")]
    public async Task<IActionResult> TestImap([FromBody] EmailTestRequest request, CancellationToken ct)
    {
        var config = await _service.GetDecryptedAsync(ct);
        if (config is null)
            return BadRequest(new { message = "IMAP nao configurado." });

        var host = request.ImapHost ?? config.ImapHost;
        var port = request.ImapPort ?? config.ImapPort;
        var enableSsl = request.ImapEnableSsl ?? config.ImapEnableSsl;
        var user = request.ImapUserName ?? config.ImapUserName;
        var pass = string.IsNullOrWhiteSpace(request.ImapPassword) ? config.ImapPassword : request.ImapPassword;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(pass))
            return BadRequest(new { message = "Dados insuficientes para teste IMAP." });

        using var client = new ImapClient();
        var options = enableSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
        await client.ConnectAsync(host, port, options, ct);
        await client.AuthenticateAsync(user, pass, ct);
        await client.DisconnectAsync(true, ct);

        return Ok(new { message = "IMAP OK" });
    }
}

public sealed class EmailTestRequest
{
    public string? SmtpHost { get; set; }
    public int? SmtpPort { get; set; }
    public bool? SmtpEnableSsl { get; set; }
    public string? SmtpUserName { get; set; }
    public string? SmtpPassword { get; set; }
    public string? FromAddress { get; set; }
    public string? FromName { get; set; }
    public string? TestTo { get; set; }

    public string? ImapHost { get; set; }
    public int? ImapPort { get; set; }
    public bool? ImapEnableSsl { get; set; }
    public string? ImapUserName { get; set; }
    public string? ImapPassword { get; set; }
}
