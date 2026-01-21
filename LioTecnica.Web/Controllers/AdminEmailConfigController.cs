using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[Authorize]
public sealed class AdminEmailConfigController : Controller
{
    private readonly EmailConfigApiClient _api;

    public AdminEmailConfigController(EmailConfigApiClient api)
    {
        _api = api;
    }

    [HttpGet("/Admin/EmailConfig")]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("/Admin/EmailConfig/_api/config")]
    public async Task<ActionResult<EmailConfigViewModel>> Get(CancellationToken ct)
    {
        var data = await _api.GetAsync(ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpPut("/Admin/EmailConfig/_api/config")]
    public async Task<ActionResult<EmailConfigViewModel>> Save(
        [FromBody] EmailConfigRequest request,
        CancellationToken ct)
    {
        var data = await _api.SaveAsync(request, ct);
        if (data is null)
            return BadRequest();
        return Ok(data);
    }

    [HttpPost("/Admin/EmailConfig/_api/test-smtp")]
    public async Task<IActionResult> TestSmtp([FromBody] EmailConfigTestRequest request, CancellationToken ct)
    {
        var ok = await _api.TestSmtpAsync(request, ct);
        if (!ok)
            return BadRequest();
        return Ok();
    }

    [HttpPost("/Admin/EmailConfig/_api/test-imap")]
    public async Task<IActionResult> TestImap([FromBody] EmailConfigTestRequest request, CancellationToken ct)
    {
        var ok = await _api.TestImapAsync(request, ct);
        if (!ok)
            return BadRequest();
        return Ok();
    }
}
