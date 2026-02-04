using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;

namespace RhPortal.Web.Infrastructure.ApiClients;

public sealed class FuncionariosApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public FuncionariosApiClient(HttpClient http) => _http = http;

    public async Task<FuncionariosPagedResponse> GetFuncionariosAsync(
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
        var query = new Dictionary<string, string?>
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

        var url = QueryHelpers.AddQueryString("/api/funcionarios", query!);

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new FuncionariosPagedResponse();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        var data = JsonSerializer.Deserialize<FuncionariosPagedResponse>(json, JsonOpts);
        return data ?? new FuncionariosPagedResponse();
    }

    public async Task<FuncionariosLookupResponse> GetLookupAsync(
        string tenantId,
        string? q,
        bool onlyActive = true,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 200);
        var query = new Dictionary<string, string?>
        {
            ["onlyActive"] = onlyActive.ToString().ToLowerInvariant(),
            ["page"] = page.ToString(),
            ["pageSize"] = pageSize.ToString()
        };
        if (!string.IsNullOrWhiteSpace(q))
            query["q"] = q.Trim();
        var url = QueryHelpers.AddQueryString("/api/lookup/funcionarios", query!);

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new FuncionariosLookupResponse();

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<FuncionariosLookupResponse>(json, JsonOpts) ?? new FuncionariosLookupResponse();
    }

    public async Task<FuncionariosPagedResponse> GetFuncionariosByUnitAsync(
        string tenantId,
        Guid unitId,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        return await GetFuncionariosAsync(tenantId, null, null, unitId, null, null, page, pageSize, "funcionario", "asc", ct);
    }

    public async Task<FuncionarioResponse?> GetByIdAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/funcionarios/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return null;

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<FuncionarioResponse>(json, JsonOpts);
    }

    public async Task<FuncionarioResponse> CreateAsync(string tenantId, FuncionarioCreateRequest request, CancellationToken ct)
    {
        // API expects Status as enum string ("Active"/"Inactive") for default model binding
        var payload = new
        {
            request.UserId,
            request.Name,
            request.Email,
            request.Phone,
            Status = request.Status == 1 ? "Active" : "Inactive",
            request.Headcount,
            request.UnitId,
            request.AreaId,
            request.JobPositionId,
            request.Notes
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/funcionarios");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            throw new HttpRequestException("Unauthorized");

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            var msg = TryGetValidationMessage(body) ?? body;
            if (string.IsNullOrWhiteSpace(msg)) msg = $"API retornou {(int)resp.StatusCode} ({resp.ReasonPhrase}).";
            throw new HttpRequestException(msg);
        }

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<FuncionarioResponse>(json, JsonOpts)!;
    }

    public async Task<FuncionarioResponse?> UpdateAsync(string tenantId, Guid id, FuncionarioUpdateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/api/funcionarios/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return null;

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            var msg = TryGetValidationMessage(body) ?? body;
            throw new HttpRequestException(string.IsNullOrWhiteSpace(msg) ? $"API retornou {(int)resp.StatusCode}." : msg);
        }

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<FuncionarioResponse>(json, JsonOpts);
    }

    public async Task<bool> DeleteAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/funcionarios/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return false;

        if (resp.StatusCode == HttpStatusCode.NotFound) return false;

        resp.EnsureSuccessStatusCode();
        return true;
    }

    public async Task<IReadOnlyList<UserWithoutFuncionarioItemDto>> GetUsersWithoutFuncionarioAsync(string tenantId, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/funcionarios/users-without-funcionario");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return Array.Empty<UserWithoutFuncionarioItemDto>();

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        var list = JsonSerializer.Deserialize<List<UserWithoutFuncionarioItemDto>>(json, JsonOpts);
        return list ?? new List<UserWithoutFuncionarioItemDto>();
    }

    private static string? TryGetValidationMessage(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("message", out var m)) return m.GetString();
            if (doc.RootElement.TryGetProperty("title", out var t)) return t.GetString();
        }
        catch { }
        return null;
    }
}

public sealed class FuncionariosPagedResponse
{
    [JsonPropertyName("items")]
    public List<FuncionarioApiItem> Items { get; set; } = new();

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; }

    [JsonPropertyName("totalItems")]
    public int TotalItems { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}

/// <summary>Deserializes Status from API: int (1/2) or string ("Active"/"Inactive").</summary>
internal sealed class FuncionarioStatusConverter : JsonConverter<int>
{
    public override int Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return n;
        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString()?.Trim();
            if (string.Equals(s, "Active", StringComparison.OrdinalIgnoreCase)) return 1;
            if (string.Equals(s, "Inactive", StringComparison.OrdinalIgnoreCase)) return 2;
        }
        return 1;
    }

    public override void Write(Utf8JsonWriter writer, int value, JsonSerializerOptions options) => writer.WriteNumberValue(value);
}

public sealed class FuncionarioApiItem
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
    [JsonConverter(typeof(FuncionarioStatusConverter))]
    public int Status { get; set; } // 1=Active, 2=Inactive

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("unitId")]
    public Guid? UnitId { get; set; }

    [JsonPropertyName("unitName")]
    public string? UnitName { get; set; }

    [JsonPropertyName("areaId")]
    public Guid? AreaId { get; set; }

    [JsonPropertyName("areaName")]
    public string? AreaName { get; set; }

    [JsonPropertyName("jobPositionId")]
    public Guid? JobPositionId { get; set; }

    [JsonPropertyName("jobPositionName")]
    public string? JobPositionName { get; set; }
}

public sealed class FuncionarioResponse
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
    [JsonConverter(typeof(FuncionarioStatusConverter))]
    public int Status { get; set; }

    [JsonPropertyName("headcount")]
    public int Headcount { get; set; }

    [JsonPropertyName("unitId")]
    public Guid? UnitId { get; set; }

    [JsonPropertyName("unitName")]
    public string? UnitName { get; set; }

    [JsonPropertyName("areaId")]
    public Guid? AreaId { get; set; }

    [JsonPropertyName("areaName")]
    public string? AreaName { get; set; }

    [JsonPropertyName("jobPositionId")]
    public Guid? JobPositionId { get; set; }

    [JsonPropertyName("jobPositionName")]
    public string? JobPositionName { get; set; }

    [JsonPropertyName("userId")]
    public Guid? UserId { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("createdAtUtc")]
    public DateTimeOffset CreatedAtUtc { get; set; }

    [JsonPropertyName("updatedAtUtc")]
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class FuncionarioCreateRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public int Status { get; set; } = 1; // Active
    public int Headcount { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? AreaId { get; set; }
    public Guid? JobPositionId { get; set; }
    public string? Notes { get; set; }
    public Guid? UserId { get; set; }
}

public sealed class UserWithoutFuncionarioItemDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("fullName")]
    public string? FullName { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("hasFuncionario")]
    public bool HasFuncionario { get; set; }
}

public sealed class FuncionarioUpdateRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public int Status { get; set; }
    public int Headcount { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? AreaId { get; set; }
    public Guid? JobPositionId { get; set; }
    public string? Notes { get; set; }
}

public sealed class FuncionariosLookupResponse
{
    [JsonPropertyName("items")]
    public List<FuncionarioLookupItemDto> Items { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("hasMore")]
    public bool HasMore { get; set; }
}

public sealed class FuncionarioLookupItemDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("nome")]
    public string? Nome { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }
}
