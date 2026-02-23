using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.Pessoas;

namespace RhPortal.Api.Controllers;

/// <summary>
/// CRUD de pessoa (dados da pessoa). Lista todas as pessoas com indicação de bloqueio.
/// </summary>
[ApiController]
[Route("api/pessoas")]
[Authorize]
public sealed class PessoasController : ControllerBase
{
    /// <summary>
    /// Lista pessoas (paginado), com indicação se estão bloqueadas.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PessoaPagedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<PessoaPagedResponse>> List(
        [FromServices] IPessoaService service,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = new PessoaListQuery(q, page, pageSize);
        var result = await service.ListAsync(query, ct);
        return Ok(result);
    }

    /// <summary>
    /// Obtém uma pessoa pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PessoaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PessoaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria uma nova pessoa.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PessoaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PessoaResponse>> Create(
        [FromBody] PessoaCreateRequest request,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        // #region agent log
        const string logPath = "/Users/victoralves/Projects/Voltage.RenderRH/.cursor/debug.log";
        try
        {
            var line = JsonSerializer.Serialize(new { hypothesisId = "B", location = "PessoasController.Create:entry", message = "Model binding OK", data = new { requestNotNull = request != null, origem = request?.Origem.ToString() }, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), sessionId = "debug-session", runId = "run1" }) + "\n";
            System.IO.File.AppendAllText(logPath, line);
        }
        catch { /* no-op */ }
        // #endregion
        var result = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Atualiza uma pessoa.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PessoaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PessoaResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] PessoaUpdateRequest request,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Remove uma pessoa.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IPessoaService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
