using System.Net.Http.Headers;
using System.Net;
using System.Text;
using System.Text.Json;

namespace RhPortal.Web.Infrastructure.ApiClients;

public sealed class UnitsApiClient
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public UnitsApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<UnitsPagedResponse> GetUnitsAsync(string tenantId, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/units");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new UnitsPagedResponse();

        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync(ct);
        var data = JsonSerializer.Deserialize<UnitsPagedResponse>(json, JsonOpts);

        return data ?? new UnitsPagedResponse();
    }

    public async Task<UnitResponse?> GetByIdAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/units/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new UnitResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<UnitResponse>(json, JsonOpts);
    }

    public async Task<UnitResponse> CreateAsync(string tenantId, UnitCreateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/units");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new UnitResponse();

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<UnitResponse>(json, JsonOpts)!;
    }

    public async Task<UnitResponse?> UpdateAsync(string tenantId, Guid id, UnitUpdateRequest request, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/api/units/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return new UnitResponse();

        if (resp.StatusCode == HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<UnitResponse>(json, JsonOpts);
    }

    public async Task<bool> DeleteAsync(string tenantId, Guid id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/units/{id}");
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == HttpStatusCode.Unauthorized)
            return false;

        if (resp.StatusCode == HttpStatusCode.NotFound) return false;

        resp.EnsureSuccessStatusCode();
        return true;
    }
}
