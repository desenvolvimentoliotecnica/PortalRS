using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class LocalizationConfigApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public LocalizationConfigApiClient(HttpClient http) => _http = http;

    public async Task<LocalizationConfigViewModel?> GetAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/localization-config", ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<LocalizationConfigViewModel>(JsonOptions, ct);
    }

    public async Task<LocalizationConfigViewModel?> SaveAsync(LocalizationConfigRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync("api/localization-config", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<LocalizationConfigViewModel>(JsonOptions, ct);
    }
}
