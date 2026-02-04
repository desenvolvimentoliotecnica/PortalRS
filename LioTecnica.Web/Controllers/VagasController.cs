using System.Text.Json;
using LioTecnica.Web.Helpers;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class VagasController : Controller
{
    private readonly VagasApiClient _vagasApi;
    private readonly PortalTenantContext _tenantContext;

    public VagasController(VagasApiClient vagasApi, PortalTenantContext tenantContext)
    {
        _vagasApi = vagasApi;
        _tenantContext = tenantContext;
    }

    public IActionResult Index()
    {
        var model = new PageSeedViewModel
        {
            SeedJson = "{}"
        };
        return View(model);
    }

    [HttpGet("/api/vagas")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.GetVagasRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/api/vagas/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.GetVagaByIdRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPost("/api/vagas")]
    public async Task<IActionResult> Create([FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.CreateRawAsync(tenantId, payload, ct);
        return ToContentResult(resp);
    }

    [HttpPut("/api/vagas/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.UpdateRawAsync(tenantId, id, payload, ct);
        return ToContentResult(resp);
    }

    [HttpDelete("/api/vagas/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.DeleteRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/api/vagas/{id:guid}/matching-candidates")]
    public async Task<IActionResult> GetMatchingCandidates(Guid id, [FromQuery] int minScore = 0, [FromQuery] int take = 50, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.GetMatchingCandidatesRawAsync(tenantId, id, minScore, take, ct);
        return ToContentResult(resp);
    }

    private static IActionResult ToContentResult(ApiRawResponse resp)
    {
        if (string.IsNullOrWhiteSpace(resp.Content))
            return new StatusCodeResult((int)resp.StatusCode);

        return new ContentResult
        {
            StatusCode = (int)resp.StatusCode,
            ContentType = "application/json",
            Content = resp.Content
        };
    }
}
