using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.PropostasVaga;
using RhPortal.Api.Contracts.PropostaVaga;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Fluxo público (sem login): candidato acessa via URL com token, visualiza a proposta
/// e registra aceite ou recusa digitalmente. Tenant vem do header `X-Tenant-Id`,
/// idêntico aos outros endpoints `/api/public/*`.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/propostas")]
public sealed class PublicPropostasVagaController : ControllerBase
{
    private readonly IPropostaVagaService _service;

    public PublicPropostasVagaController(IPropostaVagaService service)
    {
        _service = service;
    }

    [HttpGet("{token}")]
    public async Task<ActionResult<PropostaVagaPublicaResponse>> Get(string token, CancellationToken ct)
    {
        var result = await _service.GetPorTokenAsync(token, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{token}/aceitar")]
    public async Task<ActionResult<PropostaVagaPublicaResponse>> Aceitar(
        string token, [FromBody] AceitarPropostaRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.AceitarPorTokenAsync(
                token,
                request.NomeConfirmado,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                Request.Headers.UserAgent.ToString(),
                ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{token}/recusar")]
    public async Task<ActionResult<PropostaVagaPublicaResponse>> Recusar(
        string token, [FromBody] RecusarPropostaRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.RecusarPorTokenAsync(
                token,
                request.NomeConfirmado,
                request.MotivoRecusa,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                Request.Headers.UserAgent.ToString(),
                ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
