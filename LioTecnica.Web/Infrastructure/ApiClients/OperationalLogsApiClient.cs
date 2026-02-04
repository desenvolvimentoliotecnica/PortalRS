using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class OperationalLogsApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public OperationalLogsApiClient(HttpClient http) => _http = http;

    public async Task<RequestLogListResponse?> ListAsync(OperationalLogsQuery query, CancellationToken ct)
    {
        var url = $"api/logs/requests?{query.ToQueryString()}";
        using var response = await _http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return null;
        if (!response.IsSuccessStatusCode)
            return null;

        return await response.Content.ReadFromJsonAsync<RequestLogListResponse>(JsonOptions, ct);
    }

    public async Task<RequestLogDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/logs/requests/{id}", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<RequestLogDetailResponse>(JsonOptions, ct);
    }

    public async Task<RequestLogSummaryResponse?> GetSummaryAsync(DateTimeOffset? from, DateTimeOffset? to, int top, CancellationToken ct)
    {
        var qs = new List<string>();
        if (from.HasValue) qs.Add($"from={Uri.EscapeDataString(from.Value.ToString("O"))}");
        if (to.HasValue) qs.Add($"to={Uri.EscapeDataString(to.Value.ToString("O"))}");
        qs.Add($"top={top}");
        var url = $"api/logs/summary?{string.Join("&", qs)}";
        using var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<RequestLogSummaryResponse>(JsonOptions, ct);
    }
}
