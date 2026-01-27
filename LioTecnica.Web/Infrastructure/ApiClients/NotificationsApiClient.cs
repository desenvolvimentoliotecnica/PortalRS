namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class NotificationsApiClient
{
    private readonly HttpClient _http;

    public NotificationsApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> GetNotificationsRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/notifications{query}", tenantId), ct);

    private static HttpRequestMessage BuildRequest(HttpMethod method, string url, string tenantId)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
        return req;
    }

    private async Task<ApiRawResponse> SendAsync(HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}
