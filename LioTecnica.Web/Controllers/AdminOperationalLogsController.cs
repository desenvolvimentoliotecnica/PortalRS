using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class AdminOperationalLogsController : Controller
{
    private readonly OperationalLogsApiClient _api;

    public AdminOperationalLogsController(OperationalLogsApiClient api)
    {
        _api = api;
    }

    [HttpGet("/Admin/OperationalLogs")]
    public IActionResult Index()
    {
        return View(new OperationalLogsPageViewModel("Logs Operacionais"));
    }

    [HttpGet("/Admin/OperationalLogs/_api/requests")]
    public async Task<ActionResult<RequestLogListResponse>> List(
        [FromQuery] OperationalLogsQuery query,
        CancellationToken ct)
    {
        var response = await _api.ListAsync(query, ct);
        if (response is null)
            return Unauthorized();
        return Ok(response);
    }

    [HttpGet("/Admin/OperationalLogs/_api/requests/{id:guid}")]
    public async Task<ActionResult<RequestLogDetailResponse>> GetById(Guid id, CancellationToken ct)
    {
        var response = await _api.GetByIdAsync(id, ct);
        if (response is null)
            return NotFound();
        return Ok(response);
    }

    [HttpGet("/Admin/OperationalLogs/_api/summary")]
    public async Task<ActionResult<RequestLogSummaryResponse>> Summary(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int top = 6,
        CancellationToken ct = default)
    {
        var response = await _api.GetSummaryAsync(from, to, top, ct);
        if (response is null)
            return NotFound();
        return Ok(response);
    }
}
