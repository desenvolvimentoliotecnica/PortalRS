using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Units.Handlers;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Units;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de unidades.
/// </summary>
[ApiController]
[Route("api/units")]
[Produces("application/json")]
public sealed class UnitsController : ControllerBase
{
    /// <summary>
    /// Lista unidades com paginação e filtros.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<UnitGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<UnitGridRowResponse>>> List(
        [FromQuery] UnitListQuery query,
        [FromServices] IListUnitsHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(query, ct));

    /// <summary>
    /// Consulta uma unidade pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(UnitResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UnitResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetUnitByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria uma nova unidade.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(UnitResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UnitResponse>> Create(
        [FromBody] UnitCreateRequest request,
        [FromServices] ICreateUnitHandler handler,
        CancellationToken ct)
    {
        try
        {
            var created = await handler.HandleAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Atualiza uma unidade.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(UnitResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UnitResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] UnitUpdateRequest request,
        [FromServices] IUpdateUnitHandler handler,
        CancellationToken ct)
    {
        try
        {
            var updated = await handler.HandleAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Remove uma unidade.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteUnitHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
