using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class AuditLogsApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AuditLogsApiClient(HttpClient http) => _http = http;

    public async Task<AuditTransactionListResponse?> ListAsync(AuditLogsQuery query, CancellationToken ct)
    {
        var url = $"api/audit/transactions?{query.ToQueryString()}";
        using var response = await _http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return null;
        if (!response.IsSuccessStatusCode)
            return null;

        return await response.Content.ReadFromJsonAsync<AuditTransactionListResponse>(JsonOptions, ct);
    }

    public async Task<AuditTransactionDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/audit/transactions/{id}", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<AuditTransactionDetailResponse>(JsonOptions, ct);
    }
}
