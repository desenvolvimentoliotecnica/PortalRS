using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class CostCentersApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public CostCentersApiClient(HttpClient http) => _http = http;

    public async Task<List<CostCenterResponse>> GetCostCentersAsync(string tenantId, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/cost-centers");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new List<CostCenterResponse>();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<List<CostCenterResponse>>(json, JsonOpts)
               ?? new List<CostCenterResponse>();
    }

    public async Task<CostCenterResponse?> GetByIdAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/cost-centers/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new CostCenterResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<CostCenterResponse>(json, JsonOpts);
    }

    public async Task<CostCenterResponse> CreateAsync(string tenantId, CostCenterCreateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/cost-centers");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new CostCenterResponse();

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<CostCenterResponse>(json, JsonOpts)!;
    }

    public async Task<CostCenterResponse?> UpdateAsync(string tenantId, Guid id, CostCenterUpdateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/api/cost-centers/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new CostCenterResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<CostCenterResponse>(json, JsonOpts);
    }

    public async Task<bool> DeleteAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/cost-centers/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return false;

        if (resp.StatusCode == HttpStatusCode.NotFound) return false;

        resp.EnsureSuccessStatusCode();
        return true;
    }
}

public sealed class CostCenterResponse
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("groupName")]
    public string? GroupName { get; set; }

    [JsonPropertyName("unitName")]
    public string? UnitName { get; set; }

    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }
}

public sealed class CostCenterCreateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? GroupName { get; set; }
    public string? UnitName { get; set; }
    public bool IsActive { get; set; }
}

public sealed class CostCenterUpdateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? GroupName { get; set; }
    public string? UnitName { get; set; }
    public bool IsActive { get; set; }
}
