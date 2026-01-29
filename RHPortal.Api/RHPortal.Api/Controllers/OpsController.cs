using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Ops;
using Microsoft.AspNetCore.SignalR;

namespace RhPortal.Api.Controllers;

public sealed record ResetDatabaseRequest(
    bool Reset = true,
    bool Clean = false,
    bool Reseed = true,
    string? ConnectionId = null);

public sealed record ResetDatabaseResponse(
    bool Ok,
    bool Reset,
    bool Clean,
    bool Reseed,
    string Environment,
    string? Message = null
);

/// <summary>
/// Operações administrativas do ambiente (uso interno).
/// </summary>
[ApiController]
[Route("api/ops")]
public sealed class OpsController : ControllerBase
{
    /// <summary>
    /// Reseta/limpa o banco e (opcionalmente) roda o seed.
    /// </summary>
    /// <remarks>
    /// Uso interno e seguro:
    /// - Bloqueado fora de Development
    /// - Pode exigir header <c>X-OPS-RESET-KEY</c> se configurado em <c>Ops:ResetKey</c>
    /// </remarks>
    [HttpPost("reset-database")]
    [ProducesResponseType(typeof(ResetDatabaseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ResetDatabaseResponse>> ResetDatabase(
        [FromServices] IServiceProvider services,
        [FromServices] IConfiguration config,
        [FromServices] IHostEnvironment env,
        [FromServices] ILogger<OpsController> logger,
        [FromBody] ResetDatabaseRequest? body = null,
        CancellationToken ct = default)
    {
        // Hard-block fora de dev (mesmo que alguém burle permissão)
        if (!env.IsDevelopment())
            return Forbid();

        // Chave extra (evita acionamento acidental / indevido)
        var expectedKey = config.GetValue<string>("Ops:ResetKey");
        if (!string.IsNullOrWhiteSpace(expectedKey))
        {
            var providedKey = Request.Headers["X-OPS-RESET-KEY"].ToString();
            if (!string.Equals(providedKey, expectedKey, StringComparison.Ordinal))
                return Unauthorized(new { error = "Invalid reset key." });
        }

        var reset = body?.Reset ?? true;
        var clean = body?.Clean ?? false;
        var reseed = body?.Reseed ?? true;

        if (!reset && !clean)
            return BadRequest(new { error = "Select at least one action: reset or clean." });

        // Loga executor (se o seu auth preenche esses claims)
        var userName = User?.Identity?.Name ?? "(unknown)";
        var userId = User?.FindFirst("sub")?.Value
                  ?? User?.FindFirst("userid")?.Value
                  ?? User?.FindFirst("id")?.Value
                  ?? "(unknown)";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "(unknown)";

        logger.LogWarning(
            "RESET DATABASE requested by UserId={UserId} UserName={UserName} Ip={Ip} Reset={Reset} Clean={Clean} Reseed={Reseed}",
            userId, userName, ip, reset, clean, reseed);

        try
        {
            IResetProgressReporter? reporter = null;
            if (!string.IsNullOrWhiteSpace(body?.ConnectionId))
            {
                var hub = HttpContext.RequestServices.GetRequiredService<IHubContext<ResetProgressHub>>();
                reporter = new SignalRResetProgressReporter(hub, body.ConnectionId);
            }

            // ✅ Overrides finos (sem mexer no appsettings)
            // Quando reseed=true, forçamos:
            // - SeedEnabled = true
            // - Vagas/Candidatos/Inbox = true (mesmo que no appsettings esteja false)
            // Quando reseed=false, desligamos tudo.
            var overrides = new DbSeeder.SeedOverrides(
                SeedEnabled: reseed,
                SeedVagasEnabled: reseed,
                SeedCandidatosEnabled: reseed,
                SeedInboxEnabled: reseed
            );

            // ✅ IMPORTANTE:
            // Use CancellationToken.None para não cancelar o reset por timeout do request/cliente.
            await DbSeeder.MigrateAndSeedAsync(
                services,
                config,
                env,
                forceResetDatabase: reset,
                forceCleanDatabase: clean,
                overrides: overrides,
                progress: reporter,
                ct: CancellationToken.None
            );

            var actionLabel = reset ? "Reset + migrate" : "Clean";
            var message = reseed
                ? $"{actionLabel} + reseed concluídos."
                : $"{actionLabel} concluídos (seed desativado).";

            return Ok(new ResetDatabaseResponse(
                Ok: true,
                Reset: reset,
                Clean: clean,
                Reseed: reseed,
                Environment: env.EnvironmentName,
                Message: message
            ));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "RESET DATABASE failed. Reset={Reset} Clean={Clean} Reseed={Reseed}", reset, clean, reseed);

            // 500 com payload amigável pro front
            return StatusCode(500, new ResetDatabaseResponse(
                Ok: false,
                Reset: reset,
                Clean: clean,
                Reseed: reseed,
                Environment: env.EnvironmentName,
                Message: ex.Message
            ));
        }
    }
}
