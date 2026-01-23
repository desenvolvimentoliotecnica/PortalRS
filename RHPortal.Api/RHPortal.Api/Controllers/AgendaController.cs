using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Application.Agenda;
using RhPortal.Api.Contracts.Agenda;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/agenda")]
public sealed class AgendaController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public AgendaController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    [RequirePermission("agenda.view")]
    [HttpGet("types")]
    public async Task<ActionResult<IReadOnlyList<AgendaEventTypeResponse>>> ListTypes(
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var items = await service.ListTypesAsync(ct);
        return Ok(items);
    }

    [RequirePermission("agenda.view")]
    [HttpGet("events")]
    public async Task<ActionResult<IReadOnlyList<AgendaEventResponse>>> ListEvents(
        [FromQuery] AgendaEventsQuery query,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var items = await service.ListEventsAsync(query, ct);
        return Ok(items);
    }

    [RequirePermission("agenda.view")]
    [HttpGet("events/{id:guid}")]
    public async Task<ActionResult<AgendaEventResponse>> GetById(
        [FromRoute] Guid id,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var item = await service.GetEventByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [RequirePermission("agenda.view")]
    [HttpPost("events")]
    public async Task<ActionResult<AgendaEventResponse>> Create(
        [FromBody] AgendaEventCreateRequest request,
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

    [RequirePermission("agenda.view")]
    [HttpPut("events/{id:guid}")]
    public async Task<ActionResult<AgendaEventResponse>> Update(
        [FromRoute] Guid id,
        [FromBody] AgendaEventUpdateRequest request,
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

    [RequirePermission("agenda.view")]
    [HttpDelete("events/{id:guid}")]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        [FromServices] AgendaService service,
        CancellationToken ct)
    {
        var removed = await service.DeleteAsync(id, ct);
        return removed ? NoContent() : NotFound();
    }
}
