using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;

namespace LioTecnica.Web.Controllers;

public class CargosController : Controller
{
    private readonly JobPositionsApiClient _jobPositionsApi;
    private readonly PortalTenantContext _tenantContext;

    public CargosController(JobPositionsApiClient jobPositionsApi, PortalTenantContext tenantContext)
    {
        _jobPositionsApi = jobPositionsApi;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Cargos")]
    public IActionResult Index()
    {
        var model = new PageSeedViewModel
        {
            SeedJson = "{}"
        };
        return View(model);
    }

    [HttpGet("/Cargos/_api")]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] Guid? areaId,
        [FromQuery] string? seniority,
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

        var apiSeniority = string.IsNullOrWhiteSpace(seniority) ? null : ToSeniorityName(seniority);

        var api = await _jobPositionsApi.GetJobPositionsAsync(
            tenantId, search, apiStatus, areaId, apiSeniority, page, pageSize, sort: "cargo", dir: "asc", ct);

        var items = (api.Items ?? new()).Select(MapToFrontCargo).ToList();

        return Ok(new
        {
            items,
            api.Page,
            api.PageSize,
            api.TotalItems,
            api.TotalPages
        });
    }

    [HttpGet("/Cargos/_api/{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var item = await _jobPositionsApi.GetByIdAsync(tenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Cargos/_api")]
    public async Task<IActionResult> Create([FromBody] JobPositionCreateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var created = await _jobPositionsApi.CreateAsync(tenantId, request, ct);
        return Ok(created);
    }

    [HttpPut("/Cargos/_api/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] JobPositionUpdateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var updated = await _jobPositionsApi.UpdateAsync(tenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Cargos/_api/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var ok = await _jobPositionsApi.DeleteAsync(tenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }

    private static object MapToFrontCargo(JobPositionGridRowApiItem c)
        => new
        {
            id = c.Id.ToString(),
            codigo = c.Code ?? "",
            nome = c.Name ?? "",
            area = c.AreaName ?? "",
            areaId = c.AreaId,
            senioridade = c.Seniority ?? "",
            gestores = c.ManagersCount,
            status = MapStatus(c.Status)
        };

    private static string MapStatus(string? s)
        => (s?.Equals("Active", StringComparison.OrdinalIgnoreCase) ?? false) ? "ativo" : "inativo";

    private static string? ToSeniorityName(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();
        return char.ToUpperInvariant(trimmed[0]) + trimmed[1..];
    }
}
