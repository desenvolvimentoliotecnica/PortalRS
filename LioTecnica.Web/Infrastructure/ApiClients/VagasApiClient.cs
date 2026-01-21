using System.Net;
using System.Text;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class VagasApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public VagasApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> GetVagasRawAsync(string tenantId, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, "api/vagas", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetVagaByIdRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, $"api/vagas/{id}", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> CreateRawAsync(string tenantId, JsonElement payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var req = BuildRequest(HttpMethod.Post, "api/vagas", tenantId, jsonBody: json);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> UpdateRawAsync(string tenantId, Guid id, JsonElement payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var req = BuildRequest(HttpMethod.Put, $"api/vagas/{id}", tenantId, jsonBody: json);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> DeleteRawAsync(string tenantId, Guid id, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Delete, $"api/vagas/{id}", tenantId);
        return SendAsync(req, ct);
    }

    public Task<ApiRawResponse> GetEnumsRawAsync(string tenantId, CancellationToken ct)
    {
        var req = BuildRequest(HttpMethod.Get, "api/lookup/enums", tenantId);
        return SendAsync(req, ct);
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId, string? jsonBody = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");

        if (jsonBody != null)
            req.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

        return req;
    }

    private async Task<ApiRawResponse> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}

public sealed record ApiRawResponse(HttpStatusCode StatusCode, string? Content);
