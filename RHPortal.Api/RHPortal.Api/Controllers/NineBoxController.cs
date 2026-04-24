using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.NineBox;
using RhPortal.Api.Contracts.NineBox;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Nine-in-Box — matriz 3×3 de Desempenho × Potencial para posicionamento de funcionários.
/// </summary>
[ApiController]
[Route("api/nine-box")]
[Authorize]
[RequireModule("desempenho")]
public sealed class NineBoxController : ControllerBase
{
    private readonly INineBoxService _service;
    private readonly ICurrentUserContext _userContext;

    public NineBoxController(INineBoxService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Retorna todos os funcionários com suas posições atuais na matriz.</summary>
    [HttpGet("matriz")]
    [ProducesResponseType(typeof(IReadOnlyList<NineBoxMatrizItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMatriz(CancellationToken ct)
        => Ok(await _service.ListMatrizAsync(ct));

    /// <summary>Retorna a avaliação mais recente de um funcionário específico.</summary>
    [HttpGet("funcionario/{funcionarioId:guid}")]
    [ProducesResponseType(typeof(NineBoxAssessmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByFuncionario(Guid funcionarioId, CancellationToken ct)
    {
        var result = await _service.GetByFuncionarioAsync(funcionarioId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Posiciona um funcionário na matriz (cria histórico de avaliação).
    /// O avaliador é automaticamente o funcionário autenticado.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(NineBoxAssessmentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] NineBoxUpsertRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } avaliadorId)
            return Forbid();

        if (request.Desempenho is < 1 or > 3)
            return BadRequest(new { message = "Desempenho deve ser 1, 2 ou 3." });

        if (request.Potencial is < 1 or > 3)
            return BadRequest(new { message = "Potencial deve ser 1, 2 ou 3." });

        try
        {
            var result = await _service.UpsertAsync(request, avaliadorId, ct);
            return CreatedAtAction(nameof(GetByFuncionario), new { funcionarioId = result.FuncionarioId }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
