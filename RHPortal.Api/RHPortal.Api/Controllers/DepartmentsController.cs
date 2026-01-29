using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Departments.Handlers;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Contracts.Departments;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Cadastro de departamentos.
/// </summary>
[ApiController]
[Route("api/departments")]
public sealed class DepartmentsController : ControllerBase
{
    /// <summary>
    /// Lista departamentos com paginação e filtros.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<DepartmentGridRowResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DepartmentGridRowResponse>>> List(
        [FromQuery] DepartmentListQuery query,
        [FromServices] IListDepartmentsHandler handler,
        CancellationToken ct)
        => Ok(await handler.HandleAsync(query, ct));

    /// <summary>
    /// Consulta um departamento pelo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DepartmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DepartmentResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] IGetDepartmentByIdHandler handler,
        CancellationToken ct)
    {
        var item = await handler.HandleAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo departamento.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(DepartmentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DepartmentResponse>> Create(
        [FromBody] DepartmentCreateRequest request,
        [FromServices] ICreateDepartmentHandler handler,
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
    /// Atualiza um departamento.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(DepartmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DepartmentResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] DepartmentUpdateRequest request,
        [FromServices] IUpdateDepartmentHandler handler,
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
    /// Remove um departamento.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] IDeleteDepartmentHandler handler,
        CancellationToken ct)
    {
        var deleted = await handler.HandleAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
