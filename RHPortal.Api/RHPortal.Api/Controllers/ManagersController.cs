using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Managers.Handlers;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Managers;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de gestores.
/// </summary>
[ApiController]
[Route("api/managers")]
public sealed class ManagersController : ControllerBase
{
    /// <summary>
    /// Lista gestores com paginação e filtros.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ManagerGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ManagerGridRowResponse>>> List(
        [FromQuery] ManagerListQuery query,
        [FromServices] IListManagersHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(query, ct));

    /// <summary>
    /// Consulta um gestor pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ManagerResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetManagerByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo gestor.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagerResponse>> Create(
        [FromBody] ManagerCreateRequest request,
        [FromServices] ICreateManagerHandler handler,
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
    /// Atualiza um gestor.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagerResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] ManagerUpdateRequest request,
        [FromServices] IUpdateManagerHandler handler,
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
    /// Remove um gestor.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteManagerHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
