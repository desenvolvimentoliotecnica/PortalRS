using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.Infrastructure.ApiClients;
using RhPortal.Web.Infrastructure.ApiClients;

namespace LioTecnica.Web.Controllers;

public class FuncionariosController : Controller
{
    private readonly FuncionariosApiClient _funcionariosApi;
    private readonly UsersApiClient _usersApi;
    private readonly PortalTenantContext _tenantContext;

    public FuncionariosController(FuncionariosApiClient funcionariosApi, UsersApiClient usersApi, PortalTenantContext tenantContext)
    {
        _funcionariosApi = funcionariosApi;
        _usersApi = usersApi;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Funcionarios")]
    public IActionResult Index()
    {
        var model = new PageSeedViewModel
        {
            SeedJson = "{}"
        };

        return View(model);
    }

    [HttpGet("/Funcionarios/_api/users-without-funcionario")]
    public async Task<IActionResult> ListUsersWithoutFuncionario(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return BadRequest(new { message = "Tenant identifier is required. Please log in again." });
        var list = await _funcionariosApi.GetUsersWithoutFuncionarioAsync(tenantId, ct);
        var payload = list.Select(u => new { id = u.Id, fullName = u.FullName ?? "", email = u.Email ?? "", hasFuncionario = u.HasFuncionario }).ToList();
        return Ok(payload);
    }

    [HttpGet("/Funcionarios/_api")]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] Guid? unitId,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? jobPositionId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 200,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return BadRequest(new { message = "Tenant identifier is required. Please log in again." });

        var apiStatus = status?.ToLowerInvariant() switch
        {
            "ativo" => "Active",
            "inativo" => "Inactive",
            _ => null
        };

        var api = await _funcionariosApi.GetFuncionariosAsync(
            tenantId, search, apiStatus, unitId, areaId, jobPositionId, page, pageSize, sort: "funcionario", dir: "asc", ct);

        var items = (api.Items ?? new()).Select(MapToFrontFuncionario).ToList();

        return Ok(new
        {
            items,
            api.Page,
            api.PageSize,
            api.TotalItems,
            api.TotalPages
        });
    }

    [HttpGet("/Funcionarios/_api/{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var item = await _funcionariosApi.GetByIdAsync(tenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Funcionarios/_api")]
    public async Task<IActionResult> Create([FromBody] FuncionarioCreateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var created = await _funcionariosApi.CreateAsync(tenantId, request, ct);
        return Ok(created);
    }

    [HttpPut("/Funcionarios/_api/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] FuncionarioUpdateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var updated = await _funcionariosApi.UpdateAsync(tenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Funcionarios/_api/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var ok = await _funcionariosApi.DeleteAsync(tenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }

    private static object MapToFrontFuncionario(FuncionarioApiItem m)
        => new
        {
            id = m.Id.ToString(),
            nome = m.Name ?? "",
            email = m.Email ?? "",
            telefone = m.Phone ?? "",
            status = m.Status == 1 ? "ativo" : "inativo",
            headcount = m.Headcount,
            unidade = m.UnitName ?? "",
            unidadeId = m.UnitId,
            area = m.AreaName ?? "",
            areaId = m.AreaId,
            cargo = m.JobPositionName ?? "",
            cargoId = m.JobPositionId
        };
}
