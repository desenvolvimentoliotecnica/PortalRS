using System.Net.Http.Json;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed record AllowedTenantItemDto(string TenantId, string Name);

public sealed record AllowedTenantsResponseDto(IReadOnlyList<AllowedTenantItemDto> Tenants);

public sealed record SwitchTenantResponseDto(string AccessToken, string TenantId);

public sealed class MeApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public MeApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<AllowedTenantsResponseDto?> GetAllowedTenantsAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/me/tenants", ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<AllowedTenantsResponseDto>(JsonOptions, ct);
    }

    public async Task<SwitchTenantResponseDto?> SwitchTenantAsync(string tenantId, CancellationToken ct)
    {
        var request = new { tenantId = tenantId.Trim() };
        using var response = await _http.PostAsJsonAsync("api/me/switch-tenant", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode)
            return null;
        return await response.Content.ReadFromJsonAsync<SwitchTenantResponseDto>(JsonOptions, ct);
    }
}
