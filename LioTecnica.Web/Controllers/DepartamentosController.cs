using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;

namespace LioTecnica.Web.Controllers;

public sealed class DepartamentosController : Controller
{
    private readonly DepartmentsApiClient _departmentsApi;
    private readonly PortalTenantContext _tenantContext;

    public DepartamentosController(DepartmentsApiClient departmentsApi, PortalTenantContext tenantContext)
    {
        _departmentsApi = departmentsApi;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Departamentos")]
    public IActionResult Index()
    {
        var model = new PageSeedViewModel
        {
            SeedJson = "{}"
        };

        return View("Index", model);
    }

    // ===== Proxy para o JS (listar com filtros) =====
    [HttpGet("/Departamentos/_api")]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? status, // "all" | "ativo" | "inativo"
        [FromQuery] Guid? areaId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 200,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;

        var apiStatus = status?.ToLowerInvariant() switch
        {
            "ativo" => "Active",
            "inativo" => "Inactive",
            _ => null
        };

        var api = await _departmentsApi.GetDepartmentsAsync(
            tenantId, search, apiStatus, areaId, page, pageSize, sort: "department", dir: "asc", ct);

        var items = (api.Items ?? new()).Select(MapToFrontDepartamento).ToList();

        return Ok(new
        {
            items,
            api.Page,
            api.PageSize,
            api.TotalItems,
            api.TotalPages
        });
    }

    [HttpGet("/Departamentos/_api/{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        var item = await _departmentsApi.GetByIdAsync(tenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Departamentos/_api")]
    public async Task<IActionResult> Create([FromBody] DepartmentCreateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        var created = await _departmentsApi.CreateAsync(tenantId, request, ct);
        return Ok(created);
    }

    [HttpPut("/Departamentos/_api/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] DepartmentUpdateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        var updated = await _departmentsApi.UpdateAsync(tenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Departamentos/_api/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        var ok = await _departmentsApi.DeleteAsync(tenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }

    // ===== Helpers =====

    private static string MapStatus(string? s)
        => (s?.Equals("Active", StringComparison.OrdinalIgnoreCase) ?? false) ? "ativo" : "inativo";

    private static object MapToFrontDepartamento(DepartmentGridRowApiItem d)
        => new
        {
            id = d.Id.ToString(),
            codigo = d.Code ?? "",
            nome = d.Name ?? "",
            gestor = d.ManagerName ?? "",
            email = d.ManagerEmail ?? "",
            location = d.Location ?? "",
            headcount = d.Headcount,
            status = MapStatus(d.Status),
            vagasOpen = d.VacanciesOpen,
            vagasTotal = d.VacanciesTotal
        };
}
