using System.Net.Http.Headers;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class DepartmentsApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public DepartmentsApiClient(HttpClient http) => _http = http;

    public async Task<IReadOnlyList<LookupOption>> GetLookupOptionsAsync(string tenantId, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/lookup/departments");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new List<LookupOption>();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<List<LookupOption>>(json, JsonOpts) ?? new List<LookupOption>();
    }

    public async Task<DepartmentsPagedResponse> GetDepartmentsAsync(
        string tenantId,
        string? search,
        string? status,     // "Active" | "Inactive" | null
        Guid? areaId,
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
            ["Page"] = page <= 0 ? "1" : page.ToString(),
            ["PageSize"] = pageSize <= 0 ? "20" : pageSize.ToString(),
            ["Sort"] = string.IsNullOrWhiteSpace(sort) ? null : sort,
            ["Dir"] = string.IsNullOrWhiteSpace(dir) ? null : dir
        };

        var url = QueryHelpers.AddQueryString("/api/departments", query!);

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new DepartmentsPagedResponse();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<DepartmentsPagedResponse>(json, JsonOpts) ?? new DepartmentsPagedResponse();
    }

    public async Task<DepartmentResponse?> GetByIdAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/departments/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new DepartmentResponse();

        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<DepartmentResponse>(json, JsonOpts);
    }

    public async Task<DepartmentResponse> CreateAsync(string tenantId, DepartmentCreateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/departments");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new DepartmentResponse();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<DepartmentResponse>(json, JsonOpts)!;
    }

    public async Task<DepartmentResponse?> UpdateAsync(string tenantId, Guid id, DepartmentUpdateRequest request, CancellationToken ct)
    {   
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/api/departments/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new DepartmentResponse();

        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<DepartmentResponse>(json, JsonOpts);
    }

    public async Task<bool> DeleteAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/departments/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return false;

        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound) return false;

        resp.EnsureSuccessStatusCode();
        return true;
    }
}

// ===== DTOs (WEB) =====

public sealed class DepartmentsPagedResponse
{
    [JsonPropertyName("items")]
    public List<DepartmentGridRowApiItem> Items { get; set; } = new();

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; }

    [JsonPropertyName("totalItems")]
    public int TotalItems { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}

public sealed class DepartmentGridRowApiItem
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("managerName")]
    public string? ManagerName { get; set; }

    [JsonPropertyName("managerEmail")]
    public string? ManagerEmail { get; set; }

    [JsonPropertyName("costCenter")]
    public string? CostCenter { get; set; }

    [JsonPropertyName("location")]
    public string? Location { get; set; }

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; } // "Active" | "Inactive"

    [JsonPropertyName("vacanciesOpen")]
    public int VacanciesOpen { get; set; }

    [JsonPropertyName("vacanciesTotal")]
    public int VacanciesTotal { get; set; }
}

public sealed class DepartmentResponse
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("areaId")]
    public Guid? AreaId { get; set; }

    [JsonPropertyName("areaName")]
    public string? AreaName { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; } // "Active" | "Inactive"

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("managerName")]
    public string? ManagerName { get; set; }

    [JsonPropertyName("managerEmail")]
    public string? ManagerEmail { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("costCenter")]
    public string? CostCenter { get; set; }

    [JsonPropertyName("branchOrLocation")]
    public string? BranchOrLocation { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("createdAtUtc")]
    public DateTime CreatedAtUtc { get; set; }

    [JsonPropertyName("updatedAtUtc")]
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class DepartmentCreateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public Guid? AreaId { get; set; }
    public string? Status { get; set; } 
    public int Headcount { get; set; }
    public string? ManagerName { get; set; }
    public string? ManagerEmail { get; set; }
    public string? Phone { get; set; }
    public string? CostCenter { get; set; }
    public string? BranchOrLocation { get; set; }
    public string? Description { get; set; }
}

public sealed class DepartmentUpdateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public Guid? AreaId { get; set; }
    public string? Status { get; set; }
    public int Headcount { get; set; }
    public string? ManagerName { get; set; }
    public string? ManagerEmail { get; set; }
    public string? Phone { get; set; }
    public string? CostCenter { get; set; }
    public string? BranchOrLocation { get; set; }
    public string? Description { get; set; }
}

public sealed class LookupOption
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }
}
