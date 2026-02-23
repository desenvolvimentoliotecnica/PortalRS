using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;

namespace LioTecnica.Web.Controllers;

/// <summary>
/// Telas de cadastro (Funções e Cargos) em /Cadastro/Funcoes e /Cadastro/Cargos.
/// </summary>
public class CadastroController : Controller
{
    private readonly RequisitoCategoriasApiClient _categoriasApi;
    private readonly JobPositionsApiClient _jobPositionsApi;
    private readonly PortalTenantContext _tenantContext;

    public CadastroController(
        RequisitoCategoriasApiClient categoriasApi,
        JobPositionsApiClient jobPositionsApi,
        PortalTenantContext tenantContext)
    {
        _categoriasApi = categoriasApi;
        _jobPositionsApi = jobPositionsApi;
        _tenantContext = tenantContext;
    }

    // ----- Funções (PFUNCAO do RM) -----

    [HttpGet("/Cadastro/Funcoes")]
    public IActionResult Funcoes()
    {
        return View("~/Views/Cadastro/Funcoes/Index.cshtml", new PageSeedViewModel { SeedJson = "{}" });
    }

    [HttpGet("/Cadastro/Funcoes/_api")]
    public async Task<IActionResult> FuncoesList(CancellationToken ct)
    {
        var items = await _categoriasApi.GetCategoriasAsync(_tenantContext.TenantId, ct);
        return Ok(new { items });
    }

    [HttpGet("/Cadastro/Funcoes/_api/{id:guid}")]
    public async Task<IActionResult> FuncoesGetById([FromRoute] Guid id, CancellationToken ct)
    {
        var item = await _categoriasApi.GetByIdAsync(_tenantContext.TenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Cadastro/Funcoes/_api")]
    public async Task<IActionResult> FuncoesCreate([FromBody] RequisitoCategoriaCreateRequest request, CancellationToken ct)
    {
        var created = await _categoriasApi.CreateAsync(_tenantContext.TenantId, request, ct);
        return Ok(created);
    }

    [HttpPut("/Cadastro/Funcoes/_api/{id:guid}")]
    public async Task<IActionResult> FuncoesUpdate([FromRoute] Guid id, [FromBody] RequisitoCategoriaUpdateRequest request, CancellationToken ct)
    {
        var updated = await _categoriasApi.UpdateAsync(_tenantContext.TenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Cadastro/Funcoes/_api/{id:guid}")]
    public async Task<IActionResult> FuncoesDelete([FromRoute] Guid id, CancellationToken ct)
    {
        var ok = await _categoriasApi.DeleteAsync(_tenantContext.TenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }

    // ----- Cargos (PCARGO do RM) -----

    [HttpGet("/Cadastro/Cargos")]
    public IActionResult Cargos()
    {
        return View("~/Views/Cadastro/Cargos/Index.cshtml", new PageSeedViewModel { SeedJson = "{}" });
    }

    [HttpGet("/Cadastro/Cargos/_api")]
    public async Task<IActionResult> CargosList(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] Guid? areaId,
        [FromQuery] string? seniority,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 200,
        CancellationToken ct = default)
    {
        var apiStatus = status?.ToLowerInvariant() switch { "ativo" => "Active", "inativo" => "Inactive", _ => null };
        var apiSeniority = string.IsNullOrWhiteSpace(seniority) ? null : (char.ToUpperInvariant(seniority.Trim()[0]) + seniority.Trim()[1..]);
        var api = await _jobPositionsApi.GetJobPositionsAsync(
            _tenantContext.TenantId, search, apiStatus, areaId, apiSeniority, page, pageSize, sort: "cargo", dir: "asc", ct);
        var items = (api.Items ?? new()).Select(c => new
        {
            id = c.Id.ToString(),
            codigo = c.Code ?? "",
            nome = c.Name ?? "",
            area = c.AreaName ?? "",
            areaId = c.AreaId,
            senioridade = c.Seniority ?? "",
            gestores = c.ManagersCount,
            status = (c.Status?.Equals("Active", StringComparison.OrdinalIgnoreCase) ?? false) ? "ativo" : "inativo"
        }).ToList();
        return Ok(new { items, api.Page, api.PageSize, api.TotalItems, api.TotalPages });
    }

    [HttpGet("/Cadastro/Cargos/_api/{id:guid}")]
    public async Task<IActionResult> CargosGetById([FromRoute] Guid id, CancellationToken ct)
    {
        var item = await _jobPositionsApi.GetByIdAsync(_tenantContext.TenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Cadastro/Cargos/_api")]
    public async Task<IActionResult> CargosCreate([FromBody] JobPositionCreateRequest request, CancellationToken ct)
    {
        var created = await _jobPositionsApi.CreateAsync(_tenantContext.TenantId, request, ct);
        return Ok(created);
    }

    [HttpPut("/Cadastro/Cargos/_api/{id:guid}")]
    public async Task<IActionResult> CargosUpdate([FromRoute] Guid id, [FromBody] JobPositionUpdateRequest request, CancellationToken ct)
    {
        var updated = await _jobPositionsApi.UpdateAsync(_tenantContext.TenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Cadastro/Cargos/_api/{id:guid}")]
    public async Task<IActionResult> CargosDelete([FromRoute] Guid id, CancellationToken ct)
    {
        var ok = await _jobPositionsApi.DeleteAsync(_tenantContext.TenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }
}
