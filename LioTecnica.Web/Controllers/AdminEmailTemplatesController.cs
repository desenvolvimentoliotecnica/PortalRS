using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.ViewModels.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[Authorize]
public sealed class AdminEmailTemplatesController : Controller
{
    private readonly EmailTemplatesApiClient _api;

    public AdminEmailTemplatesController(EmailTemplatesApiClient api)
    {
        _api = api;
    }

    [HttpGet("/Admin/EmailTemplates")]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("/Admin/EmailTemplates/_api/templates")]
    public async Task<ActionResult<IReadOnlyList<EmailTemplateListItemViewModel>>> List(
        [FromQuery] bool includeInactive,
        CancellationToken ct)
    {
        var data = await _api.ListAsync(includeInactive, ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpGet("/Admin/EmailTemplates/_api/templates/{id:guid}")]
    public async Task<ActionResult<EmailTemplateResponseViewModel>> Get(Guid id, CancellationToken ct)
    {
        var data = await _api.GetAsync(id, ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpPost("/Admin/EmailTemplates/_api/templates")]
    public async Task<ActionResult<EmailTemplateResponseViewModel>> Create(
        [FromBody] EmailTemplateCreateViewModel request,
        CancellationToken ct)
    {
        var data = await _api.CreateAsync(request, ct);
        if (data is null)
            return Conflict();
        return Ok(data);
    }

    [HttpPut("/Admin/EmailTemplates/_api/templates/{id:guid}")]
    public async Task<ActionResult<EmailTemplateResponseViewModel>> Update(
        Guid id,
        [FromBody] EmailTemplateUpdateViewModel request,
        CancellationToken ct)
    {
        var data = await _api.UpdateAsync(id, request, ct);
        if (data is null)
            return NotFound();
        return Ok(data);
    }

    [HttpPost("/Admin/EmailTemplates/_api/templates/{id:guid}/set-active")]
    public async Task<IActionResult> SetActive(Guid id, CancellationToken ct)
    {
        var ok = await _api.SetActiveAsync(id, ct);
        if (!ok)
            return NotFound();
        return Ok();
    }

    [HttpGet("/api/email-templates")]
    public Task<ActionResult<IReadOnlyList<EmailTemplateListItemViewModel>>> LegacyList(
        [FromQuery] bool includeInactive,
        CancellationToken ct)
    {
        return List(includeInactive, ct);
    }

    [HttpGet("/api/email-templates/{id:guid}")]
    public Task<ActionResult<EmailTemplateResponseViewModel>> LegacyGet(Guid id, CancellationToken ct)
    {
        return Get(id, ct);
    }

    [HttpPost("/api/email-templates")]
    public Task<ActionResult<EmailTemplateResponseViewModel>> LegacyCreate(
        [FromBody] EmailTemplateCreateViewModel request,
        CancellationToken ct)
    {
        return Create(request, ct);
    }

    [HttpPut("/api/email-templates/{id:guid}")]
    public Task<ActionResult<EmailTemplateResponseViewModel>> LegacyUpdate(
        Guid id,
        [FromBody] EmailTemplateUpdateViewModel request,
        CancellationToken ct)
    {
        return Update(id, request, ct);
    }

    [HttpPost("/api/email-templates/{id:guid}/set-active")]
    public Task<IActionResult> LegacySetActive(Guid id, CancellationToken ct)
    {
        return SetActive(id, ct);
    }
}
