using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class OpsApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public OpsApiClient(HttpClient http)
    {
        _http = http;
    }

    /// <summary>
    /// Chama a API: POST api/ops/reset-database
    /// Retorna true se ok, false se falhou.
    /// </summary>
    public async Task<bool> ResetDatabaseAsync(bool reset, bool clean, bool reseed, string? connectionId, CancellationToken ct)
    {
        var request = new ResetDatabaseRequest(reset, clean, reseed, connectionId);

        using var response = await _http.PostAsJsonAsync("api/ops/reset-database", request, JsonOptions, ct);

        // Se quiser tratar 401/403 sem exception:
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            return false;

        return response.IsSuccessStatusCode;
    }

    public sealed record ResetDatabaseRequest(
        bool Reset,
        bool Clean,
        bool Reseed,
        string? ConnectionId);
}
