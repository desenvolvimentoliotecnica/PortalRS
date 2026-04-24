using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Implementação do <see cref="IGeocodingService"/> usando Nominatim
/// (OpenStreetMap, gratuito). Endpoint: <c>https://nominatim.openstreetmap.org/search</c>.
///
/// <b>Restrições do Nominatim</b> (https://operations.osmfoundation.org/policies/nominatim/):
/// - Máximo 1 request/segundo por aplicação
/// - User-Agent obrigatório identificando a aplicação
/// - Cache obrigatório no client (não martelar a mesma query)
///
/// O cache é responsabilidade do consumidor (campos persistidos
/// Empresa.Latitude / Pessoa.Latitude + GeocodificadoEmUtc).
///
/// Se a chamada falhar por qualquer motivo (timeout, 429, 5xx, JSON malformado),
/// retorna null silenciosamente e loga warning. O consumidor deixa lat/lng como
/// null e o MatchingService trata como score parcial.
/// </summary>
public sealed class NominatimGeocodingService : IGeocodingService
{
    private readonly HttpClient _http;
    private readonly ILogger<NominatimGeocodingService> _logger;

    public NominatimGeocodingService(HttpClient http, ILogger<NominatimGeocodingService> logger)
    {
        _http = http;
        _logger = logger;

        // Configurações fixas (idempotentes — set sempre)
        if (_http.BaseAddress is null)
            _http.BaseAddress = new Uri("https://nominatim.openstreetmap.org/");

        if (!_http.DefaultRequestHeaders.Contains("User-Agent"))
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("Voltage-RenderRH/1.0 (Lucas Machado <lucas.machado@liotecnica.com.br>)");

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
        // Se nenhum campo útil de endereço, nem tenta
        if (string.IsNullOrWhiteSpace(cep) &&
            string.IsNullOrWhiteSpace(cidade) &&
            string.IsNullOrWhiteSpace(logradouro))
        {
            return null;
        }

        // Monta query — Nominatim aceita endereço livre estilo Google
        var partes = new List<string>();
        if (!string.IsNullOrWhiteSpace(logradouro)) partes.Add(logradouro.Trim());
        if (!string.IsNullOrWhiteSpace(numero)) partes.Add(numero.Trim());
        if (!string.IsNullOrWhiteSpace(cidade)) partes.Add(cidade.Trim());
        if (!string.IsNullOrWhiteSpace(uf)) partes.Add(uf.Trim());
        if (!string.IsNullOrWhiteSpace(cep)) partes.Add(cep.Trim());
        partes.Add("Brasil"); // restringe ao Brasil para reduzir falsos positivos

        var query = string.Join(", ", partes);
        var url = $"search?q={Uri.EscapeDataString(query)}&format=json&limit=1&addressdetails=0&countrycodes=br";

        try
        {
            using var resp = await _http.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Nominatim retornou {Status} para query '{Query}'", resp.StatusCode, query);
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0)
            {
                _logger.LogInformation("Nominatim sem resultados para query '{Query}'", query);
                return null;
            }

            var first = doc.RootElement[0];
            if (!first.TryGetProperty("lat", out var latProp) ||
                !first.TryGetProperty("lon", out var lonProp))
            {
                return null;
            }

            // Nominatim retorna lat/lon como strings — parse com cultura invariável (ponto decimal)
            if (!decimal.TryParse(latProp.GetString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lat) ||
                !decimal.TryParse(lonProp.GetString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lon))
            {
                return null;
            }

            var displayName = first.TryGetProperty("display_name", out var dnProp) ? dnProp.GetString() : null;
            return new GeocodeResult(lat, lon, displayName);
        }
        catch (TaskCanceledException)
        {
            // Timeout (10s) — segue a vida sem coords
            _logger.LogWarning("Nominatim timeout para query '{Query}'", query);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado em Nominatim para query '{Query}'", query);
            return null;
        }
    }
}
