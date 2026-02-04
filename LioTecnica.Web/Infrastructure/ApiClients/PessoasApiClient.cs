using System.Net;
using System.Text;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class PessoasApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public PessoasApiClient(HttpClient http) => _http = http;

    public async Task<ApiRawResponse> ListAsync(
        string tenantId,
        string? q,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var url = "api/pessoas?page=" + Math.Max(1, page) + "&pageSize=" + Math.Clamp(pageSize, 1, 100);
        if (!string.IsNullOrWhiteSpace(q))
            url += "&q=" + Uri.EscapeDataString(q);
        var req = BuildRequest(HttpMethod.Get, url, tenantId);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> GetByIdAsync(string tenantId, Guid id, CancellationToken ct = default)
    {
        var req = BuildRequest(HttpMethod.Get, "api/pessoas/" + id, tenantId);
        return await SendAsync(req, ct);
    }

    public async Task<ApiRawResponse> UpdateAsync(string tenantId, Guid id, object payload, CancellationToken ct = default)
    {
        var body = JsonSerializer.Serialize(payload, JsonOpts);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var req = BuildRequest(HttpMethod.Put, "api/pessoas/" + id, tenantId, content);
        return await SendAsync(req, ct);
    }

    private static HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId, HttpContent? body = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
        if (body != null)
            req.Content = body;
        return req;
    }

    private async Task<ApiRawResponse> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}
