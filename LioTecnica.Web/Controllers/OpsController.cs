using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;

namespace LioTecnica.Web.Controllers;

public sealed class OpsController : Controller
{
    private readonly OpsApiClient _opsApi;

    public OpsController(OpsApiClient opsApi)
    {
        _opsApi = opsApi;
    }

    public sealed record ResetDatabaseRequest(bool Reseed = true);

    // Esse é o endpoint que seu JS chama:
    // fetch('/ops/reset-database', { method: 'POST', body: { reseed: true/false } })
    //[RequirePermission("ops.resetdb")] // por enquanto pode remover, mas recomendo manter
    [HttpPost("/ops/reset-database")]
    public async Task<IActionResult> ResetDatabase([FromBody] ResetDatabaseRequest body, CancellationToken ct)
    {
        var ok = await _opsApi.ResetDatabaseAsync(body.Reseed, ct);
        if (!ok)
            return StatusCode(500, new { ok = false, message = "Unable to reset database." });

        return Ok(new { ok = true, reseed = body.Reseed });
    }
}
