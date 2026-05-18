using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Geocodificação por CEP via BrasilAPI (quando o payload traz coordenadas).
/// Complementa Nominatim/Photon em ambientes corporativos.
/// </summary>
public sealed partial class BrasilApiCepGeocodingService
{
    private readonly HttpClient _http;
    private readonly ILogger<BrasilApiCepGeocodingService> _logger;

    public BrasilApiCepGeocodingService(HttpClient http, ILogger<BrasilApiCepGeocodingService> logger)
    {
        _http = http;
        _logger = logger;
        if (_http.BaseAddress is null)
            _http.BaseAddress = new Uri("https://brasilapi.com.br/");
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
        var digits = DigitsOnly(cep);
        if (digits.Length != 8) return null;

        try
        {
            using var resp = await _http.GetAsync($"api/cep/v2/{digits}", ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("BrasilAPI CEP {Cep} retornou {Status}", digits, resp.StatusCode);
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("location", out var location))
                return null;

            if (!TryParseCoordinates(location, out var lat, out var lon))
                return null;

            var display = doc.RootElement.TryGetProperty("street", out var street)
                ? street.GetString()
                : $"{cidade}/{uf}";
            return new GeocodeResult(lat, lon, display);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "BrasilAPI CEP falhou para {Cep}", digits);
            return null;
        }
    }

    private static bool TryParseCoordinates(JsonElement location, out decimal lat, out decimal lon)
    {
        lat = lon = 0;
        if (!location.TryGetProperty("coordinates", out var coords))
            return false;

        // GeoJSON: [lon, lat]
        if (coords.ValueKind == JsonValueKind.Array && coords.GetArrayLength() >= 2)
        {
            lon = (decimal)coords[0].GetDouble();
            lat = (decimal)coords[1].GetDouble();
            return lat != 0 || lon != 0;
        }

        // Objeto { "latitude": ..., "longitude": ... }
        if (coords.ValueKind == JsonValueKind.Object)
        {
            if (coords.TryGetProperty("latitude", out var latEl) &&
                coords.TryGetProperty("longitude", out var lonEl))
            {
                lat = (decimal)latEl.GetDouble();
                lon = (decimal)lonEl.GetDouble();
                return lat != 0 || lon != 0;
            }
        }

        return false;
    }

    private static string DigitsOnly(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        return DigitsRegex().Replace(value, "");
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex DigitsRegex();
}
