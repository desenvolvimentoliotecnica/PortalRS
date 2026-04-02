using System.Net;
using System.Net.Mail;
using MailKit.Net.Imap;
using MailKit.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

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
    private readonly ITenantContext _tenantContext;

    public EmailConfigController(IEmailConfigService service, IStringLocalizer<InfrastructureMessages> localizer, ITenantContext tenantContext)
    {
        _service = service;
        _localizer = localizer;
        _tenantContext = tenantContext;
    }

    private void EnsureTenantFromHeader()
    {
        if (!string.IsNullOrWhiteSpace(_tenantContext.TenantId)) return;
        if (Request.Headers.TryGetValue("X-Tenant-Id", out var tid) && !string.IsNullOrWhiteSpace(tid))
            _tenantContext.SetTenantId(tid!);
    }

    /// <summary>
    /// Obtém a configuração de e-mail atual (valores sensíveis mascarados).
    /// </summary>
    [AllowAnonymous]
    [HttpGet]
    [ProducesResponseType(typeof(EmailConfigView), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmailConfigView>> Get(CancellationToken ct)
    {
        EnsureTenantFromHeader();
        var data = await _service.GetAsync(ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    /// <summary>
    /// Salva a configuração de e-mail (SMTP/IMAP).
    /// </summary>
    [AllowAnonymous]
    [HttpPut]
    [ProducesResponseType(typeof(EmailConfigView), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmailConfigView>> Save([FromBody] EmailConfigDto dto, CancellationToken ct)
    {
        EnsureTenantFromHeader();
        var data = await _service.SaveAsync(dto, ct);
        return Ok(data);
    }

    /// <summary>
    /// Testa o envio via SMTP usando os dados informados (ou atuais).
    /// </summary>
    [AllowAnonymous]
    [HttpPost("test-smtp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TestSmtp([FromBody] EmailTestRequest request, CancellationToken ct)
    {
        var host = request.SmtpHost;
        var port = request.SmtpPort ?? 587;
        var enableSsl = request.SmtpEnableSsl ?? true;
        var user = request.SmtpUserName;
        var pass = request.SmtpPassword;
        var fromAddress = request.FromAddress ?? user;
        var fromName = request.FromName ?? "Portal RH";
        var to = request.TestTo ?? fromAddress;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress) || string.IsNullOrWhiteSpace(to))
            return BadRequest(new { message = "Preencha Host, From Address e email de destino para testar." });

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl
        };

        if (!string.IsNullOrWhiteSpace(user) && !string.IsNullOrWhiteSpace(pass))
            client.Credentials = new NetworkCredential(user, pass);

        using var msg = new MailMessage
        {
            From = new MailAddress(fromAddress, fromName),
            Subject = "Teste SMTP — Portal RH",
            Body = "Este é um email de teste do Portal RH. Se você recebeu, o SMTP está funcionando!",
            IsBodyHtml = false
        };
        msg.To.Add(to);

        try
        {
            await client.SendMailAsync(msg, ct);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"SMTP falhou: {ex.Message}" });
        }
        return Ok(new { message = "SMTP OK — email enviado com sucesso!" });
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
