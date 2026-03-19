using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Comunicacao;

namespace RhPortal.Api.Controllers;

[ApiController]
[Authorize]
public sealed class ComunicacaoController : ControllerBase
{
    private readonly IComunicacaoService _service;

    public ComunicacaoController(IComunicacaoService service) => _service = service;

    /// <summary>Histórico de comunicações com um candidato.</summary>
    [HttpGet("api/candidatos/{candidatoId:guid}/comunicacoes")]
    public async Task<IActionResult> ListByCandidato(Guid candidatoId, CancellationToken ct)
        => Ok(await _service.ListByCandidatoAsync(candidatoId, ct));

    /// <summary>Enviar email para candidato (registra no log).</summary>
    [HttpPost("api/comunicacoes/email")]
    public async Task<IActionResult> EnviarEmail([FromBody] EnviarEmailRequest request, CancellationToken ct)
        => Created("", await _service.EnviarEmailAsync(request, User, ct));

    /// <summary>Registrar contato (WhatsApp, LinkedIn, telefone).</summary>
    [HttpPost("api/comunicacoes/contato")]
    public async Task<IActionResult> RegistrarContato([FromBody] RegistrarContatoRequest request, CancellationToken ct)
        => Created("", await _service.RegistrarContatoAsync(request, User, ct));

    /// <summary>Gera link wa.me para WhatsApp.</summary>
    [HttpGet("api/candidatos/{candidatoId:guid}/whatsapp-link")]
    public async Task<IActionResult> WhatsAppLink(Guid candidatoId, [FromQuery] string? mensagem, CancellationToken ct)
    {
        var link = await _service.GerarWhatsAppLinkAsync(candidatoId, mensagem, ct);
        return Ok(new { link });
    }
}
