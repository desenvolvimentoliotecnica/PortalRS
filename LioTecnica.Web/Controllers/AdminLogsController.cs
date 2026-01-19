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
}
