using System.Net;
using System.Net.Mail;
using MailKit.Net.Imap;
using MailKit.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Messaging.Email;

/// <summary>
/// Configuração de e-mail (SMTP/IMAP) do tenant.
/// </summary>
[ApiController]
[Authorize]
[Route("api/email-config")]
public sealed class EmailConfigController : ControllerBase
{
    private readonly IEmailConfigService _service;
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;

    public EmailConfigController(IEmailConfigService service, IStringLocalizer<InfrastructureMessages> localizer)
    {
        _service = service;
        _localizer = localizer;
    }

    /// <summary>
    /// Obtém a configuração de e-mail atual (valores sensíveis mascarados).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(EmailConfigView), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmailConfigView>> Get(CancellationToken ct)
    {
        var data = await _service.GetAsync(ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    /// <summary>
    /// Salva a configuração de e-mail (SMTP/IMAP).
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(EmailConfigView), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailConfigView>> Save([FromBody] EmailConfigDto dto, CancellationToken ct)
    {
        var data = await _service.SaveAsync(dto, ct);
        return Ok(data);
    }

    /// <summary>
    /// Testa o envio via SMTP usando os dados informados (ou atuais).
    /// </summary>
    [HttpPost("test-smtp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TestSmtp([FromBody] EmailTestRequest request, CancellationToken ct)
    {
        var config = await _service.GetDecryptedAsync(ct);
        if (config is null)
            return BadRequest(new { message = _localizer["InfrastructureEmail.SmtpNotConfigured"] });

        var host = request.SmtpHost ?? config.SmtpHost;
        var port = request.SmtpPort ?? config.SmtpPort;
        var enableSsl = request.SmtpEnableSsl ?? config.SmtpEnableSsl;
        var user = request.SmtpUserName ?? config.SmtpUserName;
        var pass = string.IsNullOrWhiteSpace(request.SmtpPassword) ? config.SmtpPassword : request.SmtpPassword;
        var fromAddress = request.FromAddress ?? config.SmtpFromAddress ?? user;
        var fromName = request.FromName ?? config.SmtpFromName ?? _localizer["InfrastructureEmail.DefaultFromName"];
        var to = request.TestTo ?? fromAddress;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress) || string.IsNullOrWhiteSpace(to))
            return BadRequest(new { message = _localizer["InfrastructureEmail.SmtpTestDataMissing"] });

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl
        };

        if (!string.IsNullOrWhiteSpace(user) && !string.IsNullOrWhiteSpace(pass))
            client.Credentials = new NetworkCredential(user, pass);

        using var msg = new MailMessage
        {
            From = new MailAddress(fromAddress, fromName),
            Subject = _localizer["InfrastructureEmail.SmtpTestSubject"],
            Body = _localizer["InfrastructureEmail.SmtpTestBody"],
            IsBodyHtml = false
        };
        msg.To.Add(to);

        await client.SendMailAsync(msg, ct);
        return Ok(new { message = _localizer["InfrastructureEmail.SmtpOk"] });
    }

    /// <summary>
    /// Testa a autenticação IMAP usando os dados informados (ou atuais).
    /// </summary>
    [HttpPost("test-imap")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TestImap([FromBody] EmailTestRequest request, CancellationToken ct)
    {
        var config = await _service.GetDecryptedAsync(ct);
        if (config is null)
            return BadRequest(new { message = _localizer["InfrastructureEmail.ImapNotConfigured"] });

        var host = request.ImapHost ?? config.ImapHost;
        var port = request.ImapPort ?? config.ImapPort;
        var enableSsl = request.ImapEnableSsl ?? config.ImapEnableSsl;
        var user = request.ImapUserName ?? config.ImapUserName;
        var pass = string.IsNullOrWhiteSpace(request.ImapPassword) ? config.ImapPassword : request.ImapPassword;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(pass))
            return BadRequest(new { message = _localizer["InfrastructureEmail.ImapTestDataMissing"] });

        using var client = new ImapClient();
        var options = enableSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
        await client.ConnectAsync(host, port, options, ct);
        await client.AuthenticateAsync(user, pass, ct);
        await client.DisconnectAsync(true, ct);

        return Ok(new { message = _localizer["InfrastructureEmail.ImapOk"] });
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
