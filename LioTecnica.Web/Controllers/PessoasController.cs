using System.Text.Json;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class PessoasController : Controller
{
    private readonly PessoasApiClient _api;
    private readonly PortalTenantContext _tenantContext;

    public PessoasController(PessoasApiClient api, PortalTenantContext tenantContext)
    {
        _api = api;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Pessoas")]
    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/api/pessoas")]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.ListAsync(tenantId, q, page, pageSize, ct);
        if (string.IsNullOrWhiteSpace(resp.Content))
            return new StatusCodeResult((int)resp.StatusCode);
        return Content(resp.Content, "application/json");
    }

    [HttpGet("/api/pessoas/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _api.GetByIdAsync(tenantId, id, ct);
        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            return NotFound();
        if (string.IsNullOrWhiteSpace(resp.Content))
            return new StatusCodeResult((int)resp.StatusCode);
        return Content(resp.Content, "application/json");
    }

    [HttpPut("/api/pessoas/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] JsonElement? body, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        if (body is null)
            return BadRequest();
        var resp = await _api.UpdateAsync(tenantId, id, body, ct);
        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            return NotFound();
        if (resp.StatusCode == System.Net.HttpStatusCode.BadRequest)
            return BadRequest(resp.Content);
        if (string.IsNullOrWhiteSpace(resp.Content))
            return new StatusCodeResult((int)resp.StatusCode);
        return Content(resp.Content, "application/json");
    }
}
