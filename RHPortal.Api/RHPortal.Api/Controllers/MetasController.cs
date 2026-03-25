using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Metas;
using RhPortal.Api.Contracts.Metas;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>Metas individuais/equipe com acompanhamento de progresso.</summary>
[ApiController]
[Route("api/metas")]
[Authorize]
public sealed class MetasController : ControllerBase
{
    private readonly IMetaService _service;
    private readonly ICurrentUserContext _userContext;

    public MetasController(IMetaService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Lista metas de um funcionário específico.</summary>
    [HttpGet("funcionario/{funcionarioId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<MetaResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListByFuncionario(Guid funcionarioId, CancellationToken ct) =>
        Ok(await _service.ListByFuncionarioAsync(funcionarioId, ct));

    /// <summary>Lista metas de toda a equipe do gestor autenticado.</summary>
    [HttpGet("minha-equipe")]
    [ProducesResponseType(typeof(IReadOnlyList<MetaResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListMinhaEquipe(CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } gestorId)
            return Forbid();

        return Ok(await _service.ListMinhaEquipeAsync(gestorId, ct));
    }

    /// <summary>Retorna uma meta pelo ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MetaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Cria uma nova meta para um funcionário.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(MetaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] MetaCreateRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } criadaPorId)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Titulo))
            return BadRequest(new { message = "Título é obrigatório." });

        if (request.ValorMeta <= 0)
            return BadRequest(new { message = "Valor meta deve ser maior que zero." });

        try
        {
            var result = await _service.CreateAsync(request, criadaPorId, ct);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Atualiza dados de uma meta.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(MetaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] MetaUpdateRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await _service.UpdateAsync(id, request, ct));
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>Atualiza apenas o progresso (valorAtual) de uma meta.</summary>
    [HttpPatch("{id:guid}/progresso")]
    [ProducesResponseType(typeof(MetaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AtualizarProgresso(Guid id, [FromBody] MetaProgressoRequest request, CancellationToken ct)
    {
        if (request.ValorAtual < 0)
            return BadRequest(new { message = "Valor atual não pode ser negativo." });

        try
        {
            return Ok(await _service.AtualizarProgressoAsync(id, request.ValorAtual, ct));
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>Cancela uma meta.</summary>
    [HttpPatch("{id:guid}/cancelar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancelar(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.CancelarAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>Remove uma meta permanentemente.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            await _service.DeleteAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
