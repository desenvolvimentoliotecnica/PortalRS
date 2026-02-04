namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class MatchingApiClient
{
    private readonly HttpClient _http;

    public MatchingApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> RecalculateRawAsync(string tenantId, Guid candidatoId, Guid vagaId, CancellationToken ct = default)
    {
        var qs = $"?candidatoId={candidatoId}&vagaId={vagaId}";
        var req = BuildRequest(HttpMethod.Post, "api/matching/recalculate" + qs, tenantId);
        return SendAsync(req, ct);
    }

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
