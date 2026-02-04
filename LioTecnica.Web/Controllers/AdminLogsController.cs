using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class AdminLogsController : Controller
{
    private readonly AuditLogsApiClient _api;

    public AdminLogsController(AuditLogsApiClient api)
    {
        _api = api;
    }

    [HttpGet("/Admin/Logs")]
    public IActionResult Index()
    {
        return View(new AuditLogsPageViewModel("Logs Transacionais"));
    }

    [HttpGet("/Admin/Logs/_api/transactions")]
    public async Task<ActionResult<AuditTransactionListResponse>> List(
        [FromQuery] AuditLogsQuery query,
        CancellationToken ct)
    {
        var response = await _api.ListAsync(query, ct);
        if (response is null)
            return Unauthorized();
        return Ok(response);
    }

    [HttpGet("/Admin/Logs/_api/transactions/{id:guid}")]
    public async Task<ActionResult<AuditTransactionDetailResponse>> GetById(Guid id, CancellationToken ct)
    {
        var response = await _api.GetByIdAsync(id, ct);
        if (response is null)
            return NotFound();
        return Ok(response);
    }

    [HttpGet("/Admin/Logs/_api/summary")]
    public async Task<ActionResult<AuditSummaryResponse>> Summary(
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

    [HttpGet("/api/audit/entity-changes")]
    public async Task<ActionResult<EntityChangesResponse>> GetEntityChanges(
        [FromQuery] string? entityName,
        [FromQuery] Guid? entityId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(entityName) || !entityId.HasValue)
            return BadRequest("entityName and entityId are required.");
        var response = await _api.GetEntityChangesAsync(entityName!, entityId.Value, page, pageSize, ct);
        if (response is null)
            return NotFound();
        return Ok(response);
    }
}
