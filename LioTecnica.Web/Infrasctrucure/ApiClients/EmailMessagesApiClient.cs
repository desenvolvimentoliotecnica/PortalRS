using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class EmailMessagesApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public EmailMessagesApiClient(HttpClient http) => _http = http;

    public async Task<EmailMessageListResponseViewModel?> ListAsync(string scope, int page, int pageSize, CancellationToken ct)
    {
        var url = $"api/emails/messages?scope={Uri.EscapeDataString(scope)}&page={page}&pageSize={pageSize}";
        using var response = await _http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            return null;
        if (!response.IsSuccessStatusCode)
            return null;

        return await response.Content.ReadFromJsonAsync<EmailMessageListResponseViewModel>(JsonOptions, ct);
    }

    public async Task<EmailSummaryViewModel?> GetSummaryAsync(string scope, CancellationToken ct)
    {
        var url = $"api/emails/summary?scope={Uri.EscapeDataString(scope)}";
        using var response = await _http.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EmailSummaryViewModel>(JsonOptions, ct);
    }

    public async Task<EmailMessageDetailViewModel?> GetAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/emails/messages/{id}", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EmailMessageDetailViewModel>(JsonOptions, ct);
    }

    public async Task<bool> RetryAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.PostAsync($"api/emails/messages/{id}/retry", null, ct);
        return response.IsSuccessStatusCode;
    }
}
