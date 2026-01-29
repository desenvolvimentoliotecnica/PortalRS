using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Agenda;
using RhPortal.Api.Contracts.Schedule;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Agenda corporativa: tipos e eventos (criação, edição, listagem).
/// </summary>
[ApiController]
[Route("api/agenda")]
public sealed class AgendaController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public AgendaController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    /// <summary>
    /// Lista os tipos de eventos disponíveis na agenda.
    /// </summary>
    [RequirePermission("agenda.view")]
    [HttpGet("types")]
    [ProducesResponseType(typeof(IReadOnlyList<ScheduleEventTypeResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<ScheduleEventTypeResponse>>> ListTypes(
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var items = await service.ListTypesAsync(ct);
        return Ok(items);
    }

    /// <summary>
    /// Lista eventos da agenda com filtros (período, tipo, participante, etc.).
    /// </summary>
    [RequirePermission("agenda.view")]
    [HttpGet("events")]
    [ProducesResponseType(typeof(IReadOnlyList<ScheduleEventResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<ScheduleEventResponse>>> ListEvents(
        [FromQuery] ScheduleEventsQuery query,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var items = await service.ListEventsAsync(query, ct);
        return Ok(items);
    }

    /// <summary>
    /// Obtém um evento da agenda pelo ID.
    /// </summary>
    [RequirePermission("agenda.view")]
    [HttpGet("events/{id:guid}")]
    [ProducesResponseType(typeof(ScheduleEventResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ScheduleEventResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var item = await service.GetEventByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>
    /// Cria um novo evento na agenda.
    /// </summary>
    [RequirePermission("agenda.view")]
    [HttpPost("events")]
    [ProducesResponseType(typeof(ScheduleEventResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ScheduleEventResponse>> Create(
        [FromBody] ScheduleEventCreateRequest request,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        try
        {
            var created = await service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.UnableToCreateEventTitle"],
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
    }

    /// <summary>
    /// Atualiza um evento da agenda pelo ID.
    /// </summary>
    [RequirePermission("agenda.view")]
    [HttpPut("events/{id:guid}")]
    [ProducesResponseType(typeof(ScheduleEventResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ScheduleEventResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] ScheduleEventUpdateRequest request,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        try
        {
            var updated = await service.UpdateAsync(id, request, ct);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ProblemDetails
            {
                Title = _localizer["ControllerErrors.UnableToUpdateEventTitle"],
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
    }

    /// <summary>
    /// Remove um evento da agenda.
    /// </summary>
    [RequirePermission("agenda.view")]
    [HttpDelete("events/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var removed = await service.DeleteAsync(id, ct);
        return removed ? NoContent() : NotFound();
    }
}
