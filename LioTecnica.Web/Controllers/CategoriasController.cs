using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.Infrastructure.ApiClients;

namespace LioTecnica.Web.Controllers;

public class CategoriasController : Controller
{
    private readonly RequisitoCategoriasApiClient _categoriasApi;
    private readonly PortalTenantContext _tenantContext;

    public CategoriasController(RequisitoCategoriasApiClient categoriasApi, PortalTenantContext tenantContext)
    {
        _categoriasApi = categoriasApi;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Categorias")]
    public IActionResult Index()
    {
        var model = new PageSeedViewModel
        {
            SeedJson = "{}"
        };
        return View(model);
    }

    [HttpGet("/Categorias/_api")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var items = await _categoriasApi.GetCategoriasAsync(tenantId, ct);

        return Ok(new { items });
    }

    [HttpGet("/Categorias/_api/{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var item = await _categoriasApi.GetByIdAsync(tenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Categorias/_api")]
    public async Task<IActionResult> Create([FromBody] RequisitoCategoriaCreateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var created = await _categoriasApi.CreateAsync(tenantId, request, ct);
        return Ok(created);
    }

    [HttpPut("/Categorias/_api/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] RequisitoCategoriaUpdateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var updated = await _categoriasApi.UpdateAsync(tenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Categorias/_api/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var ok = await _categoriasApi.DeleteAsync(tenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }
}
