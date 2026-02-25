using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[ApiController]
[Route("bff/dashboard")]
public sealed class BffDashboardController : ControllerBase
{
    private readonly DashboardApiClient _dashboardApi;
    private readonly PortalTenantContext _tenantContext;

    public BffDashboardController(DashboardApiClient dashboardApi, PortalTenantContext tenantContext)
    {
        _dashboardApi = dashboardApi;
        _tenantContext = tenantContext;
    }

    [AllowAnonymous]
    [HttpGet("kpis")]
    public async Task<IActionResult> GetKpis(CancellationToken ct)
    {
        if (User?.Identity?.IsAuthenticated != true)
            return Unauthorized();

        var tenantId = _tenantContext.TenantId;
        var resp = await _dashboardApi.GetKpisRawAsync(tenantId, ct);

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

