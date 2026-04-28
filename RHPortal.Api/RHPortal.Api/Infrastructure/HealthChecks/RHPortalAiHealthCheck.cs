using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using RhPortal.Api.Infrastructure.Configuration;

namespace RhPortal.Api.Infrastructure.HealthChecks;

/// <summary>
/// Health check do serviço Python <c>RHPortal.Ai</c>. Bate em
/// <c>{RhAi.BaseUrl}/health/ready</c> com timeout curto.
///
/// <para>
/// Resultado:
/// <list type="bullet">
///   <item><see cref="HealthStatus.Healthy"/>: HTTP 2xx do Python.</item>
///   <item><see cref="HealthStatus.Degraded"/>: HTTP non-2xx (Python responde mas não está pronto).</item>
///   <item><see cref="HealthStatus.Unhealthy"/>: erro de rede / timeout.</item>
/// </list>
/// </para>
/// <para>
/// Quando <c>RhAi.BaseUrl</c> está vazio (config legada/sem IA externa),
/// reporta <see cref="HealthStatus.Healthy"/> com data informando "skipped"
/// — evita falso negativo em ambientes que não usam o serviço Python.
/// </para>
/// <para>Fase 5 LLM-agnóstico — LUC-014 (2026-04-26).</para>
/// </summary>
public sealed class RHPortalAiHealthCheck : IHealthCheck
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<RhAiOptions> _options;

    public RHPortalAiHealthCheck(IHttpClientFactory httpClientFactory, IOptions<RhAiOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        var baseUrl = _options.Value.BaseUrl?.Trim();
        if (string.IsNullOrEmpty(baseUrl))
        {
            return HealthCheckResult.Healthy(
                description: "RhAi.BaseUrl não configurado — health check ignorado",
                data: new Dictionary<string, object> { ["status"] = "skipped" });
        }

        var url = baseUrl.TrimEnd('/') + "/health/ready";

        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(3);
            using var response = await client.GetAsync(url, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            var data = new Dictionary<string, object>
            {
                ["url"] = url,
                ["statusCode"] = (int)response.StatusCode,
                ["body"] = body.Length > 500 ? body[..500] + "…" : body,
            };

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy("RHPortal.Ai OK", data)
                : HealthCheckResult.Degraded($"RHPortal.Ai não está pronto (HTTP {(int)response.StatusCode})", null, data);
        }
        catch (TaskCanceledException ex)
        {
            return HealthCheckResult.Unhealthy("Timeout chamando RHPortal.Ai", ex,
                new Dictionary<string, object> { ["url"] = url });
        }
        catch (HttpRequestException ex)
        {
            return HealthCheckResult.Unhealthy("RHPortal.Ai inacessível", ex,
                new Dictionary<string, object> { ["url"] = url });
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Erro inesperado no health check de RHPortal.Ai", ex,
                new Dictionary<string, object> { ["url"] = url });
        }
    }
}
