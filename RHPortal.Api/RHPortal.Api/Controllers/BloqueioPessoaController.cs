using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.BloqueioPessoa;
using RhPortal.Api.Contracts.BloqueioPessoa;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Bloqueio de pessoa (blacklist). Lista, cadastro manual, envio a partir de candidato/funcionário/talento e remoção.
/// </summary>
[ApiController]
[Route("api/bloqueio-pessoa")]
[Authorize]
public sealed class BloqueioPessoaController : ControllerBase
{
    /// <summary>
    /// Lista pessoas bloqueadas (paginado).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BloqueioPessoaPagedResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<BloqueioPessoaPagedResponse>> List(
        [FromServices] IBloqueioPessoaService service,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = new BloqueioPessoaListQuery(q, page, pageSize);
        var result = await service.ListAsync(query, ct);
        return Ok(result);
    }

    /// <summary>
    /// Obtém um bloqueio pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BloqueioPessoaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloqueioPessoaResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cadastra bloqueio manual (cria/associa Pessoa e adiciona à blacklist).
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BloqueioPessoaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BloqueioPessoaResponse>> CreateManual(
        [FromBody] BloqueioPessoaCreateManualRequest request,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var result = await service.CreateManualAsync(request, ct);
        if (result is null)
            return Conflict(new { message = "Pessoa já está bloqueada." });
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Adiciona à blacklist a partir de um candidato (resolve Pessoa via Talento ou cria).
    /// </summary>
    [HttpPost("from-candidato/{candidatoId:guid}")]
    [ProducesResponseType(typeof(BloqueioPessoaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BloqueioPessoaResponse>> CreateFromCandidato(
        [FromRoute] Guid candidatoId,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var result = await service.CreateFromCandidatoAsync(candidatoId, ct);
        if (result is null)
            return NotFound();
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Adiciona à blacklist a partir de um funcionário (resolve Pessoa ou cria).
    /// </summary>
    [HttpPost("from-funcionario/{funcionarioId:guid}")]
    [ProducesResponseType(typeof(BloqueioPessoaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BloqueioPessoaResponse>> CreateFromFuncionario(
        [FromRoute] Guid funcionarioId,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var result = await service.CreateFromFuncionarioAsync(funcionarioId, ct);
        if (result is null)
            return NotFound();
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Bloqueia uma pessoa já cadastrada (por PessoaId). Usado na tela de Pessoas.
    /// </summary>
    [HttpPost("block/{pessoaId:guid}")]
    [ProducesResponseType(typeof(BloqueioPessoaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BloqueioPessoaResponse>> BlockByPessoaId(
        [FromRoute] Guid pessoaId,
        [FromBody] BloqueioPessoaBlockByPessoaRequest? body,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var motivo = body?.Motivo?.Trim();
        var result = await service.BlockByPessoaIdAsync(pessoaId, motivo, ct);
        if (result is null)
            return Conflict(new { message = "Pessoa já está bloqueada." });
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Adiciona à blacklist a partir de um talento (Pessoa já existe).
    /// </summary>
    [HttpPost("from-talento/{talentoId:guid}")]
    [ProducesResponseType(typeof(BloqueioPessoaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BloqueioPessoaResponse>> CreateFromTalento(
        [FromRoute] Guid talentoId,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var result = await service.CreateFromTalentoAsync(talentoId, ct);
        if (result is null)
            return NotFound();
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Verifica se uma pessoa está bloqueada (por PessoaId). Retorna o bloqueio se existir; 404 caso contrário.
    /// </summary>
    [HttpGet("by-pessoa/{pessoaId:guid}")]
    [ProducesResponseType(typeof(BloqueioPessoaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BloqueioPessoaResponse>> GetByPessoaId(
        [FromRoute] Guid pessoaId,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var item = await service.GetByPessoaIdAsync(pessoaId, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Remove o bloqueio (a Pessoa permanece).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IBloqueioPessoaService service,
        CancellationToken ct)
    {
        var deleted = await service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
