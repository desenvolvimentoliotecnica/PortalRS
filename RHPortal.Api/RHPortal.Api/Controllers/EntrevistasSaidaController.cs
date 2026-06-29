using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.EntrevistasSaida;
using RhPortal.Api.Contracts.EntrevistasSaida;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Admin: templates e relatório de entrevistas de saída.
/// </summary>
[ApiController]
[Route("api/entrevistas-saida")]
public sealed class EntrevistasSaidaController : ControllerBase
{
    private readonly IEntrevistaSaidaService _service;

    public EntrevistasSaidaController(IEntrevistaSaidaService service)
    {
        _service = service;
    }

    /// <summary>Template ativo do tenant com perguntas ordenadas.</summary>
    [HttpGet("template-ativo")]
    [RequirePermission("folha.entrevista-saida.manage")]
    [ProducesResponseType(typeof(TemplateEntrevistaSaidaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTemplateAtivo(CancellationToken ct)
    {
        var template = await _service.GetTemplateAtivoAsync(ct);
        return template is null ? NotFound() : Ok(template);
    }

    /// <summary>Upsert do template ativo (1 por tenant).</summary>
    [HttpPut("template-ativo")]
    [RequirePermission("folha.entrevista-saida.manage")]
    [ProducesResponseType(typeof(TemplateEntrevistaSaidaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpsertTemplateAtivo(
        [FromBody] TemplateEntrevistaSaidaUpsertRequest request,
        CancellationToken ct)
    {
        try
        {
            var template = await _service.UpsertTemplateAtivoAsync(request, ct);
            return Ok(template);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Relatório agregado de entrevistas de saída respondidas.</summary>
    [HttpGet("relatorio")]
    [RequirePermission("folha.entrevista-saida.manage")]
    [ProducesResponseType(typeof(EntrevistaSaidaRelatorio), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRelatorio(
        [FromQuery] DateOnly? de,
        [FromQuery] DateOnly? ate,
        CancellationToken ct)
    {
        var relatorio = await _service.GetRelatorioAsync(de, ate, ct);
        return Ok(relatorio);
    }
}

/// <summary>
/// Público: formulário de entrevista de saída (sem autenticação).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/exit-interview")]
public sealed class PublicEntrevistaController : ControllerBase
{
    private readonly IEntrevistaSaidaService _service;

    public PublicEntrevistaController(IEntrevistaSaidaService service)
    {
        _service = service;
    }

    /// <summary>Retorna as perguntas do formulário para o token público.</summary>
    [HttpGet("{token}")]
    [ProducesResponseType(typeof(EntrevistaSaidaFormulario), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFormulario(string token, CancellationToken ct)
    {
        var form = await _service.GetFormularioAsync(token, ct);
        return form is null ? NotFound() : Ok(form);
    }

    /// <summary>Salva as respostas do formulário de entrevista de saída.</summary>
    [HttpPost("{token}/submit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Submit(string token, [FromBody] ExitInterviewSubmitRequest request, CancellationToken ct)
    {
        var resultado = await _service.SubmitAsync(token, request.Respostas, ct);
        return resultado switch
        {
            EntrevistaSaidaResultado.Sucesso        => NoContent(),
            EntrevistaSaidaResultado.TokenInvalido  => NotFound(new { message = "Token inválido." }),
            EntrevistaSaidaResultado.Expirado       => Conflict(new { message = "Este link expirou." }),
            EntrevistaSaidaResultado.JaPreenchido   => Conflict(new { message = "Formulário já foi preenchido." }),
            _                                       => StatusCode(StatusCodes.Status500InternalServerError)
        };
    }
}

public sealed record ExitInterviewSubmitRequest(IReadOnlyList<RespostaDto> Respostas);
