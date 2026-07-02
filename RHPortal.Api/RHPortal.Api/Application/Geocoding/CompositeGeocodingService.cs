using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Enriquece endereço via BrasilAPI CEP e tenta geocodificar em cadeia:
/// Nominatim → Photon → BrasilAPI (coordenadas do CEP, quando existirem).
/// </summary>
public sealed class CompositeGeocodingService : IGeocodingService
{
    private readonly BrasilApiCepLookupService _cepLookup;
    private readonly NominatimGeocodingService _nominatim;
    private readonly PhotonGeocodingService _photon;
    private readonly BrasilApiCepGeocodingService _brasilApiCep;
    private readonly ILogger<CompositeGeocodingService> _logger;

    public CompositeGeocodingService(
        BrasilApiCepLookupService cepLookup,
        NominatimGeocodingService nominatim,
        PhotonGeocodingService photon,
        BrasilApiCepGeocodingService brasilApiCep,
        ILogger<CompositeGeocodingService> logger)
    {
        _cepLookup = cepLookup;
        _nominatim = nominatim;
        _photon = photon;
        _brasilApiCep = brasilApiCep;
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
        var lookup = await _cepLookup.LookupAsync(cep, ct);
        var enriched = CepAddressEnrichment.Apply(cep, logradouro, numero, null, cidade, uf, lookup);

        if (lookup is not null &&
            enriched.Logradouro is not null &&
            !string.Equals(enriched.Logradouro, logradouro?.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation(
                "Endereço enriquecido via CEP {Cep}: logradouro '{Original}' → '{Enriquecido}'",
                lookup.CepDigits,
                logradouro,
                enriched.Logradouro);
        }

        var providers = new (string Name, Func<Task<GeocodeResult?>> Call)[]
        {
            ("Nominatim", () => _nominatim.GeocodeAsync(
                enriched.Cep, enriched.Logradouro, enriched.Numero, enriched.Cidade, enriched.Uf, ct)),
            ("Photon", () => _photon.GeocodeAsync(
                enriched.Cep, enriched.Logradouro, enriched.Numero, enriched.Cidade, enriched.Uf, ct)),
            ("BrasilAPI-CEP", () => Task.FromResult(_brasilApiCep.GeocodeFromLookup(lookup))),
        };

        foreach (var (name, call) in providers)
        {
            GeocodeResult? result;
            try
            {
                result = await call();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Provedor {Provider} lançou exceção", name);
                continue;
            }

            if (result is not null)
            {
                _logger.LogInformation(
                    "Geocodificação OK via {Provider} → {Lat}, {Lon}",
                    name, result.Latitude, result.Longitude);
                return result;
            }

            _logger.LogDebug("Provedor {Provider} sem resultado", name);
        }

        return null;
    }
}
