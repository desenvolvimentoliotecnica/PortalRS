using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Admin;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class ApiKeysApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ApiKeysApiClient(HttpClient http) => _http = http;

    public async Task<IReadOnlyList<ApiKeyViewModel>> ListAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/api-keys", ct);
        if (!response.IsSuccessStatusCode)
            return Array.Empty<ApiKeyViewModel>();
        var list = await response.Content.ReadFromJsonAsync<List<ApiKeyViewModel>>(JsonOptions, ct);
        return list ?? new List<ApiKeyViewModel>();
    }

    public async Task<ApiKeyViewModel?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"api/api-keys/{id}", ct);
        if (response.StatusCode == HttpStatusCode.NotFound || !response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<ApiKeyViewModel>(JsonOptions, ct);
    }

    public async Task<ApiKeyCreateResponse?> CreateAsync(ApiKeyCreateRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/api-keys", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<ApiKeyCreateResponse>(JsonOptions, ct);
    }

    public async Task<bool> RevokeAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"api/api-keys/{id}", ct);
        return response.IsSuccessStatusCode;
    }
}
