using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[Authorize]
public sealed class AdminEmailsController : Controller
{
    private readonly EmailMessagesApiClient _api;

    public AdminEmailsController(EmailMessagesApiClient api)
    {
        _api = api;
    }

    [HttpGet("/Admin/Emails")]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("/Admin/Emails/_api/messages")]
    public async Task<ActionResult<EmailMessageListResponseViewModel>> List(
        [FromQuery] string scope = "mine",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var data = await _api.ListAsync(scope, page, pageSize, ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpGet("/Admin/Emails/_api/summary")]
    public async Task<ActionResult<EmailSummaryViewModel>> Summary(
        [FromQuery] string scope = "mine",
        CancellationToken ct = default)
    {
        var data = await _api.GetSummaryAsync(scope, ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpGet("/Admin/Emails/_api/messages/{id:guid}")]
    public async Task<ActionResult<EmailMessageDetailViewModel>> Get(Guid id, CancellationToken ct = default)
    {
        var data = await _api.GetAsync(id, ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpPost("/Admin/Emails/_api/messages/{id:guid}/retry")]
    public async Task<IActionResult> Retry(Guid id, CancellationToken ct = default)
    {
        var ok = await _api.RetryAsync(id, ct);
        if (!ok)
            return BadRequest();
        return Ok();
    }
}
