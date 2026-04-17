using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Painel unificado de integração TOTVS — consolida todas as solicitações aprovadas
/// para acompanhamento de envio ao Progress Datasul.
/// </summary>
[ApiController]
[Route("api/integracao-totvs")]
[Authorize]
public sealed class IntegracaoTotvsController : ControllerBase
{
    private readonly IIntegracaoTotvsService _service;

    public IntegracaoTotvsController(IIntegracaoTotvsService service)
    {
        _service = service;
    }

    /// <summary>Lista o painel unificado de integração com filtros e paginação.</summary>
    [HttpGet("painel")]
    [ProducesResponseType(typeof(IntegracaoTotvsPainelResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPainel(
        [FromQuery] TipoIntegracao? tipo,
        [FromQuery] IntegracaoResultado? resultado,
        [FromQuery] string? search,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var query = new IntegracaoTotvsPainelQuery(tipo, resultado, search, skip, take);
        return Ok(await _service.ListPainelAsync(query, ct));
    }

    /// <summary>Retorna todos os dados de uma solicitação específica para integração.</summary>
    [HttpGet("{tipo:int}/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDetalhe(int tipo, Guid id, CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        var result = await _service.GetDetalheAsync((TipoIntegracao)tipo, id, ct);
        return result is null ? NotFound(new { message = "Registro não encontrado." }) : Ok(result);
    }

    /// <summary>Registra o resultado de uma integração (sucesso ou falha).</summary>
    [HttpPost("{tipo:int}/{id:guid}/resultado")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegistrarResultado(
        int tipo,
        Guid id,
        [FromBody] IntegracaoTotvsResultadoRequest request,
        CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        try
        {
            await _service.RegistrarResultadoAsync((TipoIntegracao)tipo, id, request, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>Relatório de reconciliação: pendentes e com falha há mais de N dias.</summary>
    [HttpGet("reconciliacao")]
    [ProducesResponseType(typeof(IntegracaoReconciliacaoResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reconciliacao(
        [FromQuery] int diasMinimos = 2,
        CancellationToken ct = default)
    {
        return Ok(await _service.ReconciliacaoAsync(diasMinimos, ct));
    }

    /// <summary>Reenvia uma integração (limpa resultado para reprocessamento).</summary>
    [HttpPost("{tipo:int}/{id:guid}/retry")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Retry(
        int tipo,
        Guid id,
        CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoIntegracao), (short)tipo))
            return BadRequest(new { message = "Tipo de integração inválido." });

        try
        {
            await _service.RetryAsync((TipoIntegracao)tipo, id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
