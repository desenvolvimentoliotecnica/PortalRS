namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class InboxApiClient
{
    private readonly HttpClient _http;

    public InboxApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> GetInboxRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/inbox{query}", tenantId), ct);

    public Task<ApiRawResponse> GetInboxByIdRawAsync(string tenantId, Guid id, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/inbox/{id}", tenantId), ct);

    public Task<ApiRawResponse> CreateRawAsync(string tenantId, string jsonBody, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Post, "api/inbox", tenantId, jsonBody), ct);

    public Task<ApiRawResponse> UpdateRawAsync(string tenantId, Guid id, string jsonBody, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Put, $"api/inbox/{id}", tenantId, jsonBody), ct);

    public Task<ApiRawResponse> DeleteRawAsync(string tenantId, Guid id, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Delete, $"api/inbox/{id}", tenantId), ct);

    private static HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId, string? jsonBody = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
        if (jsonBody != null)
            req.Content = new StringContent(jsonBody, System.Text.Encoding.UTF8, "application/json");
        return req;
    }

    private async Task<ApiRawResponse> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}
