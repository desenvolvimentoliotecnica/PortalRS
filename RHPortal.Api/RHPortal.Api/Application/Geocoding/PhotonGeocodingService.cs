using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Fallback de geocodificação via Photon (Komoot/OSM). Útil quando Nominatim
/// está bloqueado no firewall do datacenter mas photon.komoot.io responde.
/// </summary>
public sealed class PhotonGeocodingService
{
    private readonly HttpClient _http;
    private readonly ILogger<PhotonGeocodingService> _logger;

    public PhotonGeocodingService(HttpClient http, ILogger<PhotonGeocodingService> logger)
    {
        _http = http;
        _logger = logger;
        if (_http.BaseAddress is null)
            _http.BaseAddress = new Uri("https://photon.komoot.io/");
        if (_http.Timeout > TimeSpan.FromSeconds(10))
            _http.Timeout = TimeSpan.FromSeconds(10);
    }

    public async Task<GeocodeResult?> GeocodeAsync(
        string? cep,
        string? logradouro,
        string? numero,
        string? cidade,
        string? uf,
        CancellationToken ct)
    {
        var query = BuildQuery(logradouro, numero, cidade, uf, cep);
        if (query is null) return null;

        var url = $"api/?q={Uri.EscapeDataString(query)}&limit=1&lang=pt";

        try
        {
            using var resp = await _http.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Photon retornou {Status} para '{Query}'", resp.StatusCode, query);
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("features", out var features) ||
                features.ValueKind != JsonValueKind.Array ||
                features.GetArrayLength() == 0)
            {
                _logger.LogInformation("Photon sem resultados para '{Query}'", query);
                return null;
            }

            var geom = features[0].GetProperty("geometry");
            if (!geom.TryGetProperty("coordinates", out var coords) ||
                coords.ValueKind != JsonValueKind.Array ||
                coords.GetArrayLength() < 2)
            {
                return null;
            }

            var lon = coords[0].GetDouble();
            var lat = coords[1].GetDouble();
            var name = features[0].TryGetProperty("properties", out var props) &&
                       props.TryGetProperty("name", out var nameProp)
                ? nameProp.GetString()
                : query;

            return new GeocodeResult((decimal)lat, (decimal)lon, name);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Photon falhou para '{Query}'", query);
            return null;
        }
    }

    private static string? BuildQuery(string? logradouro, string? numero, string? cidade, string? uf, string? cep)
    {
        var partes = new List<string>();
        if (!string.IsNullOrWhiteSpace(logradouro))
        {
            var rua = logradouro.Trim();
            if (!string.IsNullOrWhiteSpace(numero))
                rua += " " + numero.Trim();
            partes.Add(rua);
        }
        if (!string.IsNullOrWhiteSpace(cidade)) partes.Add(cidade.Trim());
        if (!string.IsNullOrWhiteSpace(uf)) partes.Add(uf.Trim());
        if (!string.IsNullOrWhiteSpace(cep)) partes.Add(cep.Trim());
        partes.Add("Brasil");
        return partes.Count <= 1 ? null : string.Join(", ", partes);
    }
}
