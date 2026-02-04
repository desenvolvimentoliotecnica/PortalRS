using System.Text.Json;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class PortalLocationApiClient
{
    private readonly HttpClient _http;

    public PortalLocationApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<string>> GetUfsAsync(CancellationToken ct)
    {
        using var res = await _http.GetAsync("api/ibge/uf/v1", ct);
        res.EnsureSuccessStatusCode();
        await using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return ExtractStrings(doc.RootElement, "sigla");
    }

    public async Task<IReadOnlyList<string>> GetCitiesAsync(string uf, CancellationToken ct)
    {
        var safeUf = (uf ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(safeUf))
            return Array.Empty<string>();

        using var res = await _http.GetAsync($"api/ibge/municipios/v1/{Uri.EscapeDataString(safeUf)}", ct);
        res.EnsureSuccessStatusCode();
        await using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return ExtractStrings(doc.RootElement, "nome");
    }

    private static IReadOnlyList<string> ExtractStrings(JsonElement root, string propertyName)
    {
        if (root.ValueKind != JsonValueKind.Array)
            return Array.Empty<string>();

        var list = new List<string>();
        foreach (var item in root.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var value = item.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                    list.Add(value!);
                continue;
            }

            if (item.ValueKind == JsonValueKind.Object &&
                item.TryGetProperty(propertyName, out var prop) &&
                prop.ValueKind == JsonValueKind.String)
            {
                var value = prop.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                    list.Add(value!);
            }
        }

        return list;
    }
}
