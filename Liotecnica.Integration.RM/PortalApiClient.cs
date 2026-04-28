using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Liotecnica.Integration.RM;

/// <summary>
/// Cliente HTTP para a API do Portal RH (áreas, departamentos, cargos, vagas).
/// Usa X-Tenant-Id e X-Api-Key (quando a API suportar API Key).
/// </summary>
public sealed class PortalApiClient
{
    private readonly HttpClient _http;
    private readonly PortalApiOptions _options;
    private readonly ILogger<PortalApiClient> _logger;

    public PortalApiClient(HttpClient http, IOptions<PortalApiOptions> options, ILogger<PortalApiClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
        var baseUrl = (_options.BaseUrl ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(baseUrl))
            baseUrl = "https://localhost:5001";
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Add("X-Tenant-Id", _options.TenantId);
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
            _http.DefaultRequestHeaders.Add("X-Api-Key", _options.ApiKey);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public HttpClient Http => _http;

    /// <summary>
    /// Consulta o status efetivo (habilitado/desabilitado) de um módulo do tenant atual
    /// no <c>ModuleCatalog</c> do Portal. Usado para gating comercial — antes de cada
    /// ciclo o worker verifica se o tenant continua com a integração contratada.
    /// Defensivo (fail-open): em caso de erro de rede ou HTTP 5xx, assume <c>true</c>
    /// para não bloquear o sync por causa de saúde da API. HTTP 404 (módulo inexistente
    /// no catálogo do Portal alvo) é tratado como desabilitado.
    /// </summary>
    public async Task<bool> IsModuleEnabledAsync(string moduleKey, CancellationToken ct)
    {
        try
        {
            var resp = await _http.GetAsync($"api/tenant-modules/{moduleKey}/status", ct);
            if (resp.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Módulo '{ModuleKey}' não existe no catálogo do Portal — assumindo OFF.", moduleKey);
                return false;
            }
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Falha HTTP {Status} ao consultar status do módulo '{ModuleKey}' — fail-open (assumindo ON).", (int)resp.StatusCode, moduleKey);
                return true;
            }
            var body = await resp.Content.ReadFromJsonAsync<TenantModuleStatusDto>(cancellationToken: ct);
            if (body is null)
            {
                _logger.LogWarning("Resposta vazia ao consultar status do módulo '{ModuleKey}' — fail-open (assumindo ON).", moduleKey);
                return true;
            }
            return body.IsEnabled;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao consultar status do módulo '{ModuleKey}' — fail-open (assumindo ON).", moduleKey);
            return true;
        }
    }

    private sealed record TenantModuleStatusDto(string Key, bool IsEnabled);
}
