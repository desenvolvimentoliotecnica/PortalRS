using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[ApiController]
[Route("bff/lookups")]
public sealed class BffLookupsController : ControllerBase
{
    private readonly VagasApiClient _vagas;
    private readonly PortalTenantContext _tenantContext;

    public BffLookupsController(VagasApiClient vagas, PortalTenantContext tenantContext)
    {
        _vagas = vagas;
        _tenantContext = tenantContext;
    }

    [AllowAnonymous]
    [HttpGet("enums")]
    public async Task<IActionResult> Enums(CancellationToken ct)
    {
        if (User?.Identity?.IsAuthenticated != true)
            return Unauthorized();

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
}

