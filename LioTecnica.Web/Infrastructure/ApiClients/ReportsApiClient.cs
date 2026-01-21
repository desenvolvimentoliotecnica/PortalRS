namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class ReportsApiClient
{
    private readonly HttpClient _http;

    public ReportsApiClient(HttpClient http) => _http = http;

    public Task<ApiRawResponse> GetCatalogRawAsync(string tenantId, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, "api/reports/catalog", tenantId), ct);

    public Task<ApiRawResponse> GetVagasRawAsync(string tenantId, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, "api/reports/vagas", tenantId), ct);

    public Task<ApiRawResponse> GetEntradaOrigemRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/reports/entrada-origem{query}", tenantId), ct);

    public Task<ApiRawResponse> GetFalhasProcessamentoRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/reports/falhas-processamento{query}", tenantId), ct);

    public Task<ApiRawResponse> GetPipelineStatusRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/reports/pipeline-status{query}", tenantId), ct);

    public Task<ApiRawResponse> GetFunilVagaRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/reports/funil-vaga{query}", tenantId), ct);

    public Task<ApiRawResponse> GetRankingMatchingRawAsync(string tenantId, string query, CancellationToken ct)
        => SendAsync(BuildRequest(HttpMethod.Get, $"api/reports/ranking-matching{query}", tenantId), ct);

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
