using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Avaliacao;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>Ciclos de avaliação de desempenho formal.</summary>
[ApiController]
[Route("api/avaliacao")]
[Authorize]
public sealed class AvaliacaoController : ControllerBase
{
    private readonly IAvaliacaoService _service;
    private readonly ICurrentUserContext _userContext;

    public AvaliacaoController(IAvaliacaoService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Lista todos os ciclos do tenant.</summary>
    [HttpGet("ciclos")]
    [ProducesResponseType(typeof(IReadOnlyList<AvaliacaoCicloResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCiclos(CancellationToken ct) =>
        Ok(await _service.ListCiclosAsync(ct));

    /// <summary>Detalhe de um ciclo com perguntas.</summary>
    [HttpGet("ciclos/{id:guid}")]
    [ProducesResponseType(typeof(AvaliacaoCicloResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCiclo(Guid id, CancellationToken ct)
    {
        var result = await _service.GetCicloAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Cria um novo ciclo de avaliação. [Admin/RH]</summary>
    [HttpPost("ciclos")]
    [ProducesResponseType(typeof(AvaliacaoCicloResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CriarCiclo([FromBody] AvaliacaoCicloCreateRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } criadoPorId)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest(new { message = "Nome é obrigatório." });

        if (request.Perguntas is null || request.Perguntas.Count == 0)
            return BadRequest(new { message = "O ciclo deve ter ao menos uma pergunta." });

        try
        {
            var result = await _service.CriarCicloAsync(request, criadoPorId, ct);
            return CreatedAtAction(nameof(GetCiclo), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Registra respostas de avaliação. Faz upsert se o avaliador já respondeu sobre o mesmo avaliando.</summary>
    [HttpPost("ciclos/{id:guid}/responder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Responder(Guid id, [FromBody] AvaliacaoResponderRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } avaliadorId)
            return Forbid();

        if (request.Respostas is null || request.Respostas.Count == 0)
            return BadRequest(new { message = "Informe ao menos uma resposta." });

        try
        {
            await _service.ResponderAsync(id, avaliadorId, request, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Fecha o ciclo. Após isso não é possível mais responder.</summary>
    [HttpPost("ciclos/{id:guid}/fechar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> FecharCiclo(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.FecharCicloAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Resultados do ciclo: score médio por avaliando.</summary>
    [HttpGet("ciclos/{id:guid}/resultados")]
    [ProducesResponseType(typeof(IReadOnlyList<AvaliacaoResultadoRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Resultados(Guid id, CancellationToken ct) =>
        Ok(await _service.ListResultadosAsync(id, ct));
}
