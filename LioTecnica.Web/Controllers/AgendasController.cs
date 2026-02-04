using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels;
using LioTecnica.Web.ViewModels.Agenda;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class AgendasController : Controller
{
    private readonly AgendasApiClient _agendasApi;

    public AgendasController(AgendasApiClient agendasApi)
    {
        _agendasApi = agendasApi;
    }

    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/Agendas/_api/types")]
    public async Task<IActionResult> ListTypes(CancellationToken ct)
    {
        var items = await _agendasApi.ListTypesAsync(ct);
        return Ok(items);
    }

    [HttpGet("/Agendas/_api/events")]
    public async Task<IActionResult> ListEvents(
        [FromQuery] DateTime? start,
        [FromQuery] DateTime? end,
        [FromQuery] string? search,
        [FromQuery] string? type,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var items = await _agendasApi.ListEventsAsync(start, end, search, type, status, ct);
        return Ok(items);
    }

    [HttpGet("/Agendas/_api/events/{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var item = await _agendasApi.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Agendas/_api/events")]
    public async Task<IActionResult> Create([FromBody] AgendaEventRequest request, CancellationToken ct)
    {
        var created = await _agendasApi.CreateAsync(request, ct);
        return created is null ? BadRequest() : Ok(created);
    }

    [HttpPut("/Agendas/_api/events/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] AgendaEventRequest request, CancellationToken ct)
    {
        var updated = await _agendasApi.UpdateAsync(id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Agendas/_api/events/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        var ok = await _agendasApi.DeleteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
