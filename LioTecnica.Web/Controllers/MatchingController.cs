using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public class MatchingController : Controller
{
    private readonly MatchingApiClient _matchingApi;
    private readonly PortalTenantContext _tenantContext;

    public MatchingController(MatchingApiClient matchingApi, PortalTenantContext tenantContext)
    {
        _matchingApi = matchingApi;
        _tenantContext = tenantContext;
    }

    public IActionResult Index()
    {
        return View();
    }

    [HttpPost("/api/matching/recalculate")]
    public async Task<IActionResult> Recalculate([FromQuery] Guid candidatoId, [FromQuery] Guid vagaId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var resp = await _matchingApi.RecalculateRawAsync(tenantId, candidatoId, vagaId, ct);
        if (resp.StatusCode == System.Net.HttpStatusCode.NoContent)
            return NoContent();
        return new ContentResult { StatusCode = (int)resp.StatusCode, Content = resp.Content, ContentType = "application/json" };
    }
}
