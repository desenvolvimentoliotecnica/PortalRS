using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Consulta BrasilAPI CEP v2 para obter endereço canônico (e coordenadas quando disponíveis).
/// Usado para enriquecer queries de geocodificação e como fallback de lat/lng.
/// </summary>
public sealed partial class BrasilApiCepLookupService
{
    private readonly HttpClient _http;
    private readonly ILogger<BrasilApiCepLookupService> _logger;

    public BrasilApiCepLookupService(HttpClient http, ILogger<BrasilApiCepLookupService> logger)
    {
        _http = http;
        _logger = logger;
        if (_http.BaseAddress is null)
            _http.BaseAddress = new Uri("https://brasilapi.com.br/");
        if (_http.Timeout > TimeSpan.FromSeconds(10))
            _http.Timeout = TimeSpan.FromSeconds(10);
    }

    public async Task<CepLookupResult?> LookupAsync(string? cep, CancellationToken ct)
    {
        var digits = DigitsOnly(cep);
        if (digits.Length != 8)
            return null;

        try
        {
            using var resp = await _http.GetAsync($"api/cep/v2/{digits}", ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogDebug("BrasilAPI CEP {Cep} retornou {Status}", digits, resp.StatusCode);
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            decimal? lat = null;
            decimal? lon = null;
            if (root.TryGetProperty("location", out var location) &&
                TryParseCoordinates(location, out var parsedLat, out var parsedLon))
            {
                lat = parsedLat;
                lon = parsedLon;
            }

            return new CepLookupResult(
                CepDigits: digits,
                Street: ReadString(root, "street"),
                Neighborhood: ReadString(root, "neighborhood"),
                City: ReadString(root, "city"),
                State: ReadString(root, "state"),
                Latitude: lat,
                Longitude: lon);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "BrasilAPI CEP lookup falhou para {Cep}", digits);
            return null;
        }
    }

    internal static bool TryParseCoordinates(JsonElement location, out decimal lat, out decimal lon)
    {
        lat = lon = 0;
        if (!location.TryGetProperty("coordinates", out var coords))
            return false;

        if (coords.ValueKind == JsonValueKind.Array && coords.GetArrayLength() >= 2)
        {
            lon = (decimal)coords[0].GetDouble();
            lat = (decimal)coords[1].GetDouble();
            return lat != 0 || lon != 0;
        }

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

    private static string? ReadString(JsonElement root, string property)
    {
        if (!root.TryGetProperty(property, out var el))
            return null;
        var value = el.GetString();
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string DigitsOnly(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        return DigitsRegex().Replace(value, "");
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex DigitsRegex();
}
