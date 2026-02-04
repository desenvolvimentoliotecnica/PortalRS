namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class DashboardApiClient
{
    private readonly HttpClient _http;

    public DashboardApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> GetKpisRawAsync(string tenantId, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, "api/dashboard/kpis", tenantId), ct);

    public Task<ApiRawResponse> GetRecebidosSeriesRawAsync(string tenantId, int days, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/dashboard/recebidos-series?days={days}", tenantId), ct);

    public Task<ApiRawResponse> GetFunnelRawAsync(string tenantId, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, "api/dashboard/funil", tenantId), ct);

    public Task<ApiRawResponse> GetTopMatchesRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/dashboard/top-matches{query}", tenantId), ct);

    public Task<ApiRawResponse> GetOpenVagasRawAsync(string tenantId, int take, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/dashboard/open-vagas?take={take}", tenantId), ct);

    public Task<ApiRawResponse> GetVagasLookupRawAsync(string tenantId, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, "api/dashboard/vagas", tenantId), ct);

    public Task<ApiRawResponse> GetAreasLookupRawAsync(string tenantId, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, "api/dashboard/areas", tenantId), ct);

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
