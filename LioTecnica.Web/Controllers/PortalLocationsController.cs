using LioTecnica.Web.Infrastructure.ApiClients;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

[AllowAnonymous]
public sealed class PortalLocationsController : Controller
{
    private readonly PortalLocationApiClient _locationApi;

    public PortalLocationsController(PortalLocationApiClient locationApi)
    {
        _locationApi = locationApi;
    }

    [HttpGet("/PortalVagas/Locations/Ufs")]
    public async Task<IActionResult> GetUfs(CancellationToken ct)
    {
        try
        {
            var list = await _locationApi.GetUfsAsync(ct);
            return Ok(list);
        }
        catch
        {
            return StatusCode(502, new { message = "Nao foi possivel carregar UFs." });
        }
    }

    [HttpGet("/PortalVagas/Locations/Ufs/{uf}/Cities")]
    public async Task<IActionResult> GetCities(string uf, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(uf))
            return BadRequest(new { message = "UF invalido." });

        try
        {
            var list = await _locationApi.GetCitiesAsync(uf, ct);
            return Ok(list);
        }
        catch
        {
            return StatusCode(502, new { message = "Nao foi possivel carregar cidades." });
        }
    }
}
