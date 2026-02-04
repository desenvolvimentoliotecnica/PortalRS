using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using RhPortal.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[ApiController]
[Route("api/lookup")]
public sealed class LookupController : ControllerBase
{
    private readonly AreasApiClient _areas;
    private readonly DepartmentsApiClient _departments;
    private readonly VagasApiClient _vagas;
    private readonly FuncionariosApiClient _funcionarios;
    private readonly JobPositionsApiClient _jobPositions;
    private readonly UsersApiClient _users;
    private readonly PortalTenantContext _tenantContext;

    public LookupController(
        AreasApiClient areas,
        DepartmentsApiClient departments,
        VagasApiClient vagas,
        FuncionariosApiClient funcionarios,
        JobPositionsApiClient jobPositions,
        UsersApiClient users,
        PortalTenantContext tenantContext)
    {
        _areas = areas;
        _departments = departments;
        _vagas = vagas;
        _funcionarios = funcionarios;
        _jobPositions = jobPositions;
        _users = users;
        _tenantContext = tenantContext;
    }

    [HttpGet("areas")]
    public async Task<IActionResult> Areas(CancellationToken ct)
    {
        var areas = await _areas.GetAreasAsync(_tenantContext.TenantId, ct);

        var result = areas
            .Where(a => a.IsActive)
            .Select(a => new { id = a.Id, code = a.Code, name = a.Name })
            .ToList();

        return Ok(result);
    }

    [HttpGet("departments")]
    public async Task<IActionResult> Departments(CancellationToken ct)
    {
        var list = await _departments.GetLookupOptionsAsync(_tenantContext.TenantId, ct);
        return Ok(list);
    }

    [HttpGet("enums")]
    public async Task<IActionResult> Enums(CancellationToken ct)
    {
        var resp = await _vagas.GetEnumsRawAsync(_tenantContext.TenantId, ct);
        if (string.IsNullOrWhiteSpace(resp.Content))
            return new StatusCodeResult((int)resp.StatusCode);

        return new ContentResult
        {
            StatusCode = (int)resp.StatusCode,
            ContentType = "application/json",
            Content = resp.Content
        };
    }

    [HttpGet("job-positions")]
    public async Task<IActionResult> JobPositions([FromQuery] Guid? areaId, CancellationToken ct)
    {
        var list = await _jobPositions.GetLookupOptionsAsync(_tenantContext.TenantId, areaId, ct);
        var items = list
            .Select(x => new { id = x.Id, code = x.Code, name = x.Name })
            .ToList();

        return Ok(items);
    }

    // GET /api/lookup/funcionarios?onlyActive=true&page=1&pageSize=50&q=ana
    [HttpGet("funcionarios")]
    public async Task<IActionResult> Funcionarios(
        [FromQuery] string? q = null,
        [FromQuery] bool onlyActive = true,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var resp = await _funcionarios.GetLookupAsync(tenantId, q, onlyActive, page, pageSize, ct);
        return Ok(new { items = resp.Items ?? new(), total = resp.Total, hasMore = resp.HasMore });
    }

    /// <summary>
    /// Lista usuários que possuem o perfil Gestor (cadastro de usuários) — para seleção no cadastro de gestores.
    /// </summary>
    [HttpGet("users-gestores")]
    public async Task<IActionResult> UsersGestores(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var list = await _users.GetUsersGestoresAsync(tenantId, ct);
        var result = list.Select(u => new { id = u.Id, name = u.Name, email = u.Email }).ToList();
        return Ok(result);
    }
}
