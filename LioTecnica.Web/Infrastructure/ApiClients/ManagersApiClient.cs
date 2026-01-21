using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;

namespace RhPortal.Web.Infrastructure.ApiClients;

public sealed class ManagersApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public ManagersApiClient(HttpClient http) => _http = http;

    public async Task<ManagersPagedResponse> GetManagersAsync(
        string tenantId,
        Guid unitId,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        var url = $"/api/managers?unitId={unitId:D}&page={page}&pageSize={pageSize}";

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new ManagersPagedResponse();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        var data = JsonSerializer.Deserialize<ManagersPagedResponse>(json, JsonOpts);

        return data ?? new ManagersPagedResponse();
    }

    public async Task<ManagersPagedResponse> GetManagersAsync(
        string tenantId,
        string? search,
        string? status,
        Guid? unitId,
        Guid? areaId,
        Guid? jobPositionId,
        int page,
        int pageSize,
        string? sort,
        string? dir,
        CancellationToken ct)
    {
        var query = new Dictionary<string, string?>()
        {
            ["Search"] = string.IsNullOrWhiteSpace(search) ? null : search,
            ["Status"] = string.IsNullOrWhiteSpace(status) ? null : status,
            ["UnitId"] = unitId.HasValue && unitId.Value != Guid.Empty ? unitId.Value.ToString() : null,
            ["AreaId"] = areaId.HasValue && areaId.Value != Guid.Empty ? areaId.Value.ToString() : null,
            ["JobPositionId"] = jobPositionId.HasValue && jobPositionId.Value != Guid.Empty ? jobPositionId.Value.ToString() : null,
            ["Page"] = page <= 0 ? "1" : page.ToString(),
            ["PageSize"] = pageSize <= 0 ? "20" : pageSize.ToString(),
            ["Sort"] = string.IsNullOrWhiteSpace(sort) ? null : sort,
            ["Dir"] = string.IsNullOrWhiteSpace(dir) ? null : dir
        };

        var url = QueryHelpers.AddQueryString("/api/managers", query!);

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new ManagersPagedResponse();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        var data = JsonSerializer.Deserialize<ManagersPagedResponse>(json, JsonOpts);

        return data ?? new ManagersPagedResponse();
    }

    public async Task<ManagerResponse?> GetByIdAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/managers/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new ManagerResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<ManagerResponse>(json, JsonOpts);
    }

    public async Task<ManagerResponse> CreateAsync(string tenantId, ManagerCreateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/managers");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new ManagerResponse();

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<ManagerResponse>(json, JsonOpts)!;
    }

    public async Task<ManagerResponse?> UpdateAsync(string tenantId, Guid id, ManagerUpdateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/api/managers/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new ManagerResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<ManagerResponse>(json, JsonOpts);
    }

    public async Task<bool> DeleteAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/managers/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return false;

        if (resp.StatusCode == HttpStatusCode.NotFound) return false;

        resp.EnsureSuccessStatusCode();
        return true;
    }
}

public sealed class ManagersPagedResponse
{
    [JsonPropertyName("items")]
    public List<ManagerApiItem> Items { get; set; } = new();

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; }

    [JsonPropertyName("totalItems")]
    public int TotalItems { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}

public sealed class ManagerApiItem
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; } // "Active"/"Inactive"

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("unitId")]
    public Guid UnitId { get; set; }

    [JsonPropertyName("unitName")]
    public string? UnitName { get; set; }

    [JsonPropertyName("areaId")]
    public Guid AreaId { get; set; }

    [JsonPropertyName("areaName")]
    public string? AreaName { get; set; }

    [JsonPropertyName("jobPositionId")]
    public Guid JobPositionId { get; set; }

    [JsonPropertyName("jobPositionName")]
    public string? JobPositionName { get; set; }
}

public sealed class ManagerResponse
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("unitId")]
    public Guid UnitId { get; set; }

    [JsonPropertyName("unitName")]
    public string? UnitName { get; set; }

    [JsonPropertyName("areaId")]
    public Guid AreaId { get; set; }

    [JsonPropertyName("areaName")]
    public string? AreaName { get; set; }

    [JsonPropertyName("jobPositionId")]
    public Guid JobPositionId { get; set; }

    [JsonPropertyName("jobPositionName")]
    public string? JobPositionName { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("createdAtUtc")]
    public DateTimeOffset CreatedAtUtc { get; set; }

    [JsonPropertyName("updatedAtUtc")]
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class ManagerCreateRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Status { get; set; }
    public int Headcount { get; set; }
    public Guid UnitId { get; set; }
    public Guid AreaId { get; set; }
    public Guid JobPositionId { get; set; }
    public string? Notes { get; set; }
}

public sealed class ManagerUpdateRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Status { get; set; }
    public int Headcount { get; set; }
    public Guid UnitId { get; set; }
    public Guid AreaId { get; set; }
    public Guid JobPositionId { get; set; }
    public string? Notes { get; set; }
}
