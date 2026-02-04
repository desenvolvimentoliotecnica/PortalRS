using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class DashboardController : Controller
{
    private readonly DashboardApiClient _dashboardApi;
    private readonly PortalTenantContext _tenantContext;

    public DashboardController(DashboardApiClient dashboardApi, PortalTenantContext tenantContext)
    {
        _dashboardApi = dashboardApi;
        _tenantContext = tenantContext;
    }

    public IActionResult Index()
    {
        // Owner não tem dashboard próprio: usa a connection Default e veria dados de outro tenant.
        // Redireciona para a lista de tenants para que selecione um tenant e use "Acessar o tenant".
        var tenantClaim = User?.FindFirst("tenant")?.Value?.Trim();
        if (string.Equals(tenantClaim, "owner", StringComparison.OrdinalIgnoreCase))
        {
            TempData["OwnerInfo"] = "Selecione um tenant (Acessar o tenant) para ver o dashboard.";
            return RedirectToAction("Tenants", "Owner");
        }

        var model = new PageSeedViewModel { SeedJson = "{}" };
        return View(model);
    }

    [HttpGet("/Dashboard/_api/kpis")]
    public async Task<IActionResult> GetKpis(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetKpisRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Dashboard/_api/recebidos-series")]
    public async Task<IActionResult> GetRecebidosSeries([FromQuery] int days, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetRecebidosSeriesRawAsync(tenantId, days, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Dashboard/_api/funil")]
    public async Task<IActionResult> GetFunnel(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetFunnelRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Dashboard/_api/top-matches")]
    public async Task<IActionResult> GetTopMatches(
        [FromQuery] int minMatch,
        [FromQuery] Guid? vagaId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int take,
        CancellationToken ct)
    {
        var query = $"?minMatch={minMatch}&take={take}";
        if (vagaId.HasValue) query += $"&vagaId={vagaId.Value}";
        if (from.HasValue) query += $"&from={Uri.EscapeDataString(from.Value.ToString("o"))}";
        if (to.HasValue) query += $"&to={Uri.EscapeDataString(to.Value.ToString("o"))}";

        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetTopMatchesRawAsync(tenantId, query, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Dashboard/_api/open-vagas")]
    public async Task<IActionResult> GetOpenVagas([FromQuery] int take, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetOpenVagasRawAsync(tenantId, take, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Dashboard/_api/vagas")]
    public async Task<IActionResult> GetVagasLookup(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetVagasLookupRawAsync(tenantId, ct);
        return ToContentResult(resp);
    }

    [HttpGet("/Dashboard/_api/areas")]
    public async Task<IActionResult> GetAreasLookup(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetAreasLookupRawAsync(tenantId, ct);
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
