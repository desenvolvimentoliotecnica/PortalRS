using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class EmailConfigApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public EmailConfigApiClient(HttpClient http) => _http = http;

    public async Task<EmailConfigViewModel?> GetAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/email-config", ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EmailConfigViewModel>(JsonOptions, ct);
    }

    public async Task<EmailConfigViewModel?> SaveAsync(EmailConfigRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync("api/email-config", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EmailConfigViewModel>(JsonOptions, ct);
    }

    public async Task<bool> TestSmtpAsync(EmailConfigTestRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/email-config/test-smtp", request, JsonOptions, ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> TestImapAsync(EmailConfigTestRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/email-config/test-imap", request, JsonOptions, ct);
        return response.IsSuccessStatusCode;
    }
}
