using System.Text.Json;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class TriagemController : Controller
{
    private readonly CandidatosApiClient _candidatosApi;
    private readonly VagasApiClient _vagasApi;
    private readonly PortalTenantContext _tenantContext;

    public TriagemController(
        CandidatosApiClient candidatosApi,
        VagasApiClient vagasApi,
        PortalTenantContext tenantContext)
    {
        _candidatosApi = candidatosApi;
        _vagasApi = vagasApi;
        _tenantContext = tenantContext;
    }

    public IActionResult Index()
    {
        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/Triagem/_api/vagas")]
    public async Task<IActionResult> GetVagas(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.GetVagasRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Triagem/_api/vagas/{id:guid}")]
    public async Task<IActionResult> GetVagaById(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _vagasApi.GetVagaByIdRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Triagem/_api/candidatos")]
    public async Task<IActionResult> GetCandidatos(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.GetCandidatosRawAsync(tenantId, q: null, statuses: null, vagaIds: null, ct: ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Triagem/_api/candidatos/{id:guid}")]
    public async Task<IActionResult> GetCandidatoById(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.GetCandidatoByIdRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Triagem/_api/candidatos/{id:guid}/status-history")]
    public async Task<IActionResult> GetCandidatoStatusHistory(Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.GetCandidatoStatusHistoryRawAsync(tenantId, id, ct);
        return ToContentResult(resp);
    }

    [HttpPut("/Triagem/_api/candidatos/{id:guid}")]
    public async Task<IActionResult> UpdateCandidato(Guid id, [FromBody] JsonElement payload, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _candidatosApi.UpdateRawAsync(tenantId, id, payload, ct);
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
