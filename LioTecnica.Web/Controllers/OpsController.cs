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

    public sealed record ResetDatabaseRequest(
        bool Reset = true,
        bool Clean = false,
        bool Reseed = true,
        string? ConnectionId = null);

    // Esse é o endpoint que seu JS chama:
    // fetch('/ops/reset-database', { method: 'POST', body: { reseed: true/false } })
    //[RequirePermission("ops.resetdb")] // por enquanto pode remover, mas recomendo manter
    [HttpPost("/ops/reset-database")]
    public async Task<IActionResult> ResetDatabase([FromBody] ResetDatabaseRequest body, CancellationToken ct)
    {
        if (!body.Reset && !body.Clean)
            return BadRequest(new { ok = false, message = "Selecione Reset ou Limpar Base." });

        var ok = await _opsApi.ResetDatabaseAsync(body.Reset, body.Clean, body.Reseed, body.ConnectionId, ct);
        if (!ok)
            return StatusCode(500, new { ok = false, message = "Unable to reset database." });

        return Ok(new { ok = true, reset = body.Reset, clean = body.Clean, reseed = body.Reseed });
    }
}
