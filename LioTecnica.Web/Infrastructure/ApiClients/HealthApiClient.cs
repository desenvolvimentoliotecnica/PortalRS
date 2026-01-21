namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class HealthApiClient
{
    private readonly HttpClient _http;

    public HealthApiClient(HttpClient http) => _http = http;

    public async Task<ApiRawResponse> GetRawAsync(CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "health");
        req.Headers.TryAddWithoutValidation("Accept", "application/json");

        using var res = await _http.SendAsync(req, ct);
        var content = await res.Content.ReadAsStringAsync(ct);
        return new ApiRawResponse(res.StatusCode, content);
    }
}
