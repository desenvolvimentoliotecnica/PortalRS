using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Geocodificação por CEP via BrasilAPI (quando o payload traz coordenadas).
/// Complementa Nominatim/Photon em ambientes corporativos.
/// </summary>
public sealed class BrasilApiCepGeocodingService
{
    private readonly BrasilApiCepLookupService _lookup;
    private readonly ILogger<BrasilApiCepGeocodingService> _logger;

    public BrasilApiCepGeocodingService(
        BrasilApiCepLookupService lookup,
        ILogger<BrasilApiCepGeocodingService> logger)
    {
        _lookup = lookup;
        _logger = logger;
    }

    public async Task<GeocodeResult?> GeocodeAsync(
        string? cep,
        string? logradouro,
        string? numero,
        string? cidade,
        string? uf,
        CancellationToken ct)
    {
        var lookup = await _lookup.LookupAsync(cep, ct);
        return GeocodeFromLookup(lookup);
    }

    internal GeocodeResult? GeocodeFromLookup(CepLookupResult? lookup)
    {
        if (lookup?.Latitude is null || lookup.Longitude is null)
            return null;

        var display = lookup.Street ?? $"{lookup.City}/{lookup.State}";
        _logger.LogDebug("BrasilAPI CEP {Cep} retornou coordenadas", lookup.CepDigits);
        return new GeocodeResult(lookup.Latitude.Value, lookup.Longitude.Value, display);
    }
}
