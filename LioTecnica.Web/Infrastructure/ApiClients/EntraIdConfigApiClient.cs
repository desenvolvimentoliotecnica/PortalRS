using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class EntraIdConfigApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public EntraIdConfigApiClient(HttpClient http) => _http = http;

    public async Task<EntraIdConfigViewModel?> GetAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/entra-config", ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EntraIdConfigViewModel>(JsonOptions, ct);
    }

    public async Task<EntraIdConfigViewModel?> SaveAsync(EntraIdConfigRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync("api/entra-config", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<EntraIdConfigViewModel>(JsonOptions, ct);
    }
}
