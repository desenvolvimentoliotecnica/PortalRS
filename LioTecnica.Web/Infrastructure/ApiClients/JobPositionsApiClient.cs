using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class JobPositionsApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public JobPositionsApiClient(HttpClient http) => _http = http;

    public async Task<IReadOnlyList<JobPositionLookupItem>> GetLookupOptionsAsync(string tenantId, Guid? areaId, CancellationToken ct)
    {
        var query = new Dictionary<string, string?>()
        {
            ["areaId"] = areaId.HasValue && areaId.Value != Guid.Empty ? areaId.Value.ToString() : null
        };

        var url = QueryHelpers.AddQueryString("/api/lookup/job-positions", query!);

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new List<JobPositionLookupItem>();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<List<JobPositionLookupItem>>(json, JsonOpts) ?? new List<JobPositionLookupItem>();
    }

    public async Task<JobPositionsPagedResponse> GetJobPositionsAsync(
        string tenantId,
        string? search,
        string? status,
        Guid? areaId,
        string? seniority,
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
            ["AreaId"] = areaId.HasValue && areaId.Value != Guid.Empty ? areaId.Value.ToString() : null,
            ["Seniority"] = string.IsNullOrWhiteSpace(seniority) ? null : seniority,
            ["Page"] = page <= 0 ? "1" : page.ToString(),
            ["PageSize"] = pageSize <= 0 ? "20" : pageSize.ToString(),
            ["Sort"] = string.IsNullOrWhiteSpace(sort) ? null : sort,
            ["Dir"] = string.IsNullOrWhiteSpace(dir) ? null : dir
        };

        var url = QueryHelpers.AddQueryString("/api/job-positions", query!);

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new JobPositionsPagedResponse();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<JobPositionsPagedResponse>(json, JsonOpts) ?? new JobPositionsPagedResponse();
    }

    public async Task<JobPositionResponse?> GetByIdAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/job-positions/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new JobPositionResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<JobPositionResponse>(json, JsonOpts);
    }

    public async Task<JobPositionResponse> CreateAsync(string tenantId, JobPositionCreateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/job-positions");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new JobPositionResponse();

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<JobPositionResponse>(json, JsonOpts)!;
    }

    public async Task<JobPositionResponse?> UpdateAsync(string tenantId, Guid id, JobPositionUpdateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/api/job-positions/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new JobPositionResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<JobPositionResponse>(json, JsonOpts);
    }

    public async Task<bool> DeleteAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/job-positions/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return false;

        if (resp.StatusCode == HttpStatusCode.NotFound) return false;

        resp.EnsureSuccessStatusCode();
        return true;
    }
}
