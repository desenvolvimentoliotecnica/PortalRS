using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.PublicApproval;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoint público para aprovação/reprovação via email (magic link).
/// Não requer autenticação — segurança garantida pelo token one-time de 72h.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/approve")]
public sealed class PublicApprovalController : ControllerBase
{
    private readonly IMagicLinkService _magicLink;

    public PublicApprovalController(IMagicLinkService magicLink)
    {
        _magicLink = magicLink;
    }

    /// <summary>
    /// Retorna o resumo da solicitação para a landing page de aprovação.
    /// Usado pelo frontend Next.js para exibir as informações antes da confirmação.
    /// </summary>
    [HttpGet("{token}")]
    [ProducesResponseType(typeof(MagicLinkSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSummary(string token, CancellationToken ct)
    {
        var summary = await _magicLink.GetSummaryAsync(token, ct);
        return summary is null ? NotFound() : Ok(summary);
    }

    /// <summary>
    /// Confirma a ação do aprovador (Aprovar ou Reprovar).
    /// </summary>
    [HttpPost("{token}/confirm")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Confirm(string token, [FromBody] MagicLinkConfirmRequest request, CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(MagicLinkAcao), request.Acao))
            return BadRequest(new { message = "Ação inválida." });

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var resultado = await _magicLink.ProcessarAcaoAsync(
            token, (MagicLinkAcao)request.Acao, request.Observacao,
            ipAddress, userAgent, ct);

        return resultado switch
        {
            MagicLinkResultado.Sucesso              => NoContent(),
            MagicLinkResultado.TokenInvalido        => NotFound(new { message = "Token inválido." }),
            MagicLinkResultado.Expirado             => Conflict(new { message = "Este link expirou. Acesse o portal para aprovar." }),
            MagicLinkResultado.JaUtilizado          => Conflict(new { message = "Este link já foi utilizado." }),
            MagicLinkResultado.EtapaJaProcessada    => Conflict(new { message = "Esta etapa já foi processada." }),
            MagicLinkResultado.SolicitacaoNaoEncontrada => NotFound(new { message = "Solicitação não encontrada." }),
            _ => StatusCode(StatusCodes.Status500InternalServerError)
        };
    }
}

public sealed record MagicLinkConfirmRequest(
    short Acao,         // 1=Aprovar, 2=Reprovar
    string? Observacao);
