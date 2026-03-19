using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using RhPortal.Api.Application.JobPositions.Handlers;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.JobPositions;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de cargos (job positions).
/// </summary>
[ApiController]
[Route("api/job-positions")]
public sealed class JobPositionsController : ControllerBase
{
    /// <summary>
    /// Lista cargos com paginação e filtros.
    /// </summary>
    [HttpGet]
    [OutputCache(PolicyName = "lookup")]
    [ProducesResponseType(typeof(PagedResult<JobPositionGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<JobPositionGridRowResponse>>> List(
        [FromQuery] JobPositionListQuery query,
        [FromServices] IListJobPositionsHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(query, ct));

    /// <summary>
    /// Consulta um cargo pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(JobPositionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<JobPositionResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetJobPositionByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo cargo.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(JobPositionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<JobPositionResponse>> Create(
        [FromBody] JobPositionCreateRequest request,
        [FromServices] ICreateJobPositionHandler handler,
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
    /// Atualiza um cargo.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(JobPositionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<JobPositionResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] JobPositionUpdateRequest request,
        [FromServices] IUpdateJobPositionHandler handler,
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
    /// Remove um cargo.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteJobPositionHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
