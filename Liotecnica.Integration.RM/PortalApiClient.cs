using System.Net.Http.Headers;
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

    public PortalApiClient(HttpClient http, IOptions<PortalApiOptions> options)
    {
        _http = http;
        _options = options.Value;
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
}
