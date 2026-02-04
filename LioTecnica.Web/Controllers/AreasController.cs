using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;

namespace LioTecnica.Web.Controllers;

public class AreasController : Controller
{
    private readonly AreasApiClient _areasApi;
    private readonly PortalTenantContext _tenantContext;

    public AreasController(AreasApiClient areasApi, PortalTenantContext tenantContext)
    {
        _areasApi = areasApi;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Areas")]
    public IActionResult Index()
    {
        var model = new PageSeedViewModel
        {
            SeedJson = "{}"
        };
        return View(model);
    }

    [HttpGet("/Areas/_api")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var items = await _areasApi.GetAreasDetailedAsync(tenantId, ct);
        return Ok(new { items });
    }

    [HttpGet("/Areas/_api/{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var item = await _areasApi.GetByIdAsync(tenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Areas/_api")]
    public async Task<IActionResult> Create([FromBody] AreaCreateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var created = await _areasApi.CreateAsync(tenantId, request, ct);
        return Ok(created);
    }

    [HttpPut("/Areas/_api/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] AreaUpdateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var updated = await _areasApi.UpdateAsync(tenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Areas/_api/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var ok = await _areasApi.DeleteAsync(tenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }
}
