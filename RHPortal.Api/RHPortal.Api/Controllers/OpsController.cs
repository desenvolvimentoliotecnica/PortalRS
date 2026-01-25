using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Controllers;

public sealed record ResetDatabaseRequest(bool Reseed = true);

public sealed record ResetDatabaseResponse(
    bool Ok,
    bool Reset,
    bool Reseed,
    string Environment,
    string? Message = null
);

[ApiController]
[Route("api/ops")]
public sealed class OpsController : ControllerBase
{
    /// <summary>
    /// Reseta o banco (DROP SCHEMA/EnsureDeleted), executa migrations e (opcionalmente) roda o seed.
    /// Proteções:
    /// - Bloqueia fora de Development
    /// - (Opcional) exige header X-OPS-RESET-KEY se estiver configurado em Ops:ResetKey
    /// </summary>
    [HttpPost("reset-database")]
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

        var reseed = body?.Reseed ?? true;

        // Loga executor (se o seu auth preenche esses claims)
        var userName = User?.Identity?.Name ?? "(unknown)";
        var userId = User?.FindFirst("sub")?.Value
                  ?? User?.FindFirst("userid")?.Value
                  ?? User?.FindFirst("id")?.Value
                  ?? "(unknown)";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "(unknown)";

        logger.LogWarning(
            "RESET DATABASE requested by UserId={UserId} UserName={UserName} Ip={Ip} Reseed={Reseed}",
            userId, userName, ip, reseed);

        try
        {
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
                forceResetDatabase: true,
                overrides: overrides,
                ct: CancellationToken.None
            );

            return Ok(new ResetDatabaseResponse(
                Ok: true,
                Reset: true,
                Reseed: reseed,
                Environment: env.EnvironmentName,
                Message: reseed
                    ? "Reset + migrate + reseed concluídos."
                    : "Reset + migrate concluídos (seed desativado)."
            ));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "RESET DATABASE failed. Reseed={Reseed}", reseed);

            // 500 com payload amigável pro front
            return StatusCode(500, new ResetDatabaseResponse(
                Ok: false,
                Reset: true,
                Reseed: reseed,
                Environment: env.EnvironmentName,
                Message: ex.Message
            ));
        }
    }
}
