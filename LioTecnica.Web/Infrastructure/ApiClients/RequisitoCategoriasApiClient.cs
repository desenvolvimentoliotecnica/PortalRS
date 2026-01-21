using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class RequisitoCategoriasApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public RequisitoCategoriasApiClient(HttpClient http) => _http = http;

    public async Task<List<RequisitoCategoriaResponse>> GetCategoriasAsync(string tenantId, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/requisito-categorias");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new List<RequisitoCategoriaResponse>();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<List<RequisitoCategoriaResponse>>(json, JsonOpts)
               ?? new List<RequisitoCategoriaResponse>();
    }

    public async Task<RequisitoCategoriaResponse?> GetByIdAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/requisito-categorias/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new RequisitoCategoriaResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<RequisitoCategoriaResponse>(json, JsonOpts);
    }

    public async Task<RequisitoCategoriaResponse> CreateAsync(string tenantId, RequisitoCategoriaCreateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/requisito-categorias");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new RequisitoCategoriaResponse();

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<RequisitoCategoriaResponse>(json, JsonOpts)!;
    }

    public async Task<RequisitoCategoriaResponse?> UpdateAsync(string tenantId, Guid id, RequisitoCategoriaUpdateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/api/requisito-categorias/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new RequisitoCategoriaResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<RequisitoCategoriaResponse>(json, JsonOpts);
    }

    public async Task<bool> DeleteAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/requisito-categorias/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return false;

        if (resp.StatusCode == HttpStatusCode.NotFound) return false;

        resp.EnsureSuccessStatusCode();
        return true;
    }
}

public sealed class RequisitoCategoriaResponse
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }
}

public sealed class RequisitoCategoriaCreateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public sealed class RequisitoCategoriaUpdateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}
