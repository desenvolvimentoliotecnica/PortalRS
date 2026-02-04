using System.Net.Http.Json;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

// DTOs for Owner AI (keys, models, usage)
public sealed record AiProviderKeyListItemDto(Guid Id, string Provider, string Name, bool IsActive, bool IsDefault, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
public sealed record AiProviderKeyCreateRequest(string Provider, string Name, string Key, bool IsDefault = false);
public sealed record AiProviderKeyUpdateRequest(string Name, bool IsActive, bool IsDefault, string? Key);

public sealed record AiModelListItemDto(Guid Id, Guid AiProviderKeyId, string ModelId, string DisplayName, bool IsDefault);
public sealed record AiModelCreateRequest(Guid AiProviderKeyId, string ModelId, string DisplayName, bool IsDefault);
public sealed record AiModelUpdateRequest(string ModelId, string DisplayName, bool IsDefault);

public sealed record AiUsageSummaryByTenantItemDto(string TenantId, decimal TotalCost, int UsageCount);
public sealed record AiUsageSummaryByTenantResponseDto(IReadOnlyList<AiUsageSummaryByTenantItemDto> ByTenant, decimal TotalCost, int TotalUsageCount);

public sealed record AiUsageSummaryByUserItemDto(string TenantId, Guid? UserId, string? UserName, decimal TotalCost, int UsageCount);
public sealed record AiUsageSummaryByUserResponseDto(IReadOnlyList<AiUsageSummaryByUserItemDto> ByUser, decimal TotalCost, int TotalUsageCount);

public sealed record AiUsageDetailItemDto(Guid Id, string TenantId, Guid? UserId, string? UserName, string Module, string? ModelDisplayName, decimal Cost, string? ActionDescription, string? RequestMessage, DateTimeOffset CreatedAtUtc);
public sealed record PagedResultDto<T>(List<T> Items, int Page, int PageSize, int TotalItems, int TotalPages);

public sealed class OwnerAiApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public OwnerAiApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<AiProviderKeyListItemDto>?> ListKeysAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/owner/ai/keys", ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<IReadOnlyList<AiProviderKeyListItemDto>>(JsonOptions, ct);
    }

    public async Task<AiProviderKeyListItemDto?> CreateKeyAsync(AiProviderKeyCreateRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/owner/ai/keys", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<AiProviderKeyListItemDto>(JsonOptions, ct);
    }

    public async Task<AiProviderKeyListItemDto?> UpdateKeyAsync(Guid id, AiProviderKeyUpdateRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/owner/ai/keys/{id}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<AiProviderKeyListItemDto>(JsonOptions, ct);
    }

    public async Task<bool> DeleteKeyAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"api/owner/ai/keys/{id}", ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<IReadOnlyList<AiModelListItemDto>?> ListModelsAsync(CancellationToken ct)
    {
        using var response = await _http.GetAsync("api/owner/ai/models", ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<IReadOnlyList<AiModelListItemDto>>(JsonOptions, ct);
    }

    public async Task<AiModelListItemDto?> CreateModelAsync(AiModelCreateRequest request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("api/owner/ai/models", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<AiModelListItemDto>(JsonOptions, ct);
    }

    public async Task<AiModelListItemDto?> UpdateModelAsync(Guid id, AiModelUpdateRequest request, CancellationToken ct)
    {
        using var response = await _http.PutAsJsonAsync($"api/owner/ai/models/{id}", request, JsonOptions, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<AiModelListItemDto>(JsonOptions, ct);
    }

    public async Task<bool> DeleteModelAsync(Guid id, CancellationToken ct)
    {
        using var response = await _http.DeleteAsync($"api/owner/ai/models/{id}", ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<AiUsageSummaryByTenantResponseDto?> GetUsageSummaryByTenantAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var q = new List<string>();
        if (from.HasValue) q.Add($"from={Uri.EscapeDataString(from.Value.ToString("o"))}");
        if (to.HasValue) q.Add($"to={Uri.EscapeDataString(to.Value.ToString("o"))}");
        var query = q.Count > 0 ? "?" + string.Join("&", q) : "";
        using var response = await _http.GetAsync("api/owner/ai/usage/summary-by-tenant" + query, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<AiUsageSummaryByTenantResponseDto>(JsonOptions, ct);
    }

    public async Task<AiUsageSummaryByUserResponseDto?> GetUsageSummaryByUserAsync(string? tenantId, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var q = new List<string>();
        if (!string.IsNullOrWhiteSpace(tenantId)) q.Add($"tenantId={Uri.EscapeDataString(tenantId)}");
        if (from.HasValue) q.Add($"from={Uri.EscapeDataString(from.Value.ToString("o"))}");
        if (to.HasValue) q.Add($"to={Uri.EscapeDataString(to.Value.ToString("o"))}");
        var query = q.Count > 0 ? "?" + string.Join("&", q) : "";
        using var response = await _http.GetAsync("api/owner/ai/usage/summary-by-user" + query, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<AiUsageSummaryByUserResponseDto>(JsonOptions, ct);
    }

    public async Task<PagedResultDto<AiUsageDetailItemDto>?> GetUsageDetailAsync(string? tenantId, Guid? userId, string? module, DateTimeOffset? from, DateTimeOffset? to, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var q = new List<string> { $"page={page}", $"pageSize={pageSize}" };
        if (!string.IsNullOrWhiteSpace(tenantId)) q.Add($"tenantId={Uri.EscapeDataString(tenantId)}");
        if (userId.HasValue) q.Add($"userId={userId.Value}");
        if (!string.IsNullOrWhiteSpace(module)) q.Add($"module={Uri.EscapeDataString(module)}");
        if (from.HasValue) q.Add($"from={Uri.EscapeDataString(from.Value.ToString("o"))}");
        if (to.HasValue) q.Add($"to={Uri.EscapeDataString(to.Value.ToString("o"))}");
        var query = "?" + string.Join("&", q);
        using var response = await _http.GetAsync("api/owner/ai/usage/detail" + query, ct);
        if (!response.IsSuccessStatusCode) return null;
        return await response.Content.ReadFromJsonAsync<PagedResultDto<AiUsageDetailItemDto>>(JsonOptions, ct);
    }
}
