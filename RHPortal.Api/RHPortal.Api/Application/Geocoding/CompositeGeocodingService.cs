using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Tenta geocodificar em cadeia: Nominatim → Photon → BrasilAPI (CEP).
/// Aumenta a chance de sucesso quando um provedor está bloqueado no firewall.
/// </summary>
public sealed class CompositeGeocodingService : IGeocodingService
{
    private readonly NominatimGeocodingService _nominatim;
    private readonly PhotonGeocodingService _photon;
    private readonly BrasilApiCepGeocodingService _brasilApiCep;
    private readonly ILogger<CompositeGeocodingService> _logger;

    public CompositeGeocodingService(
        NominatimGeocodingService nominatim,
        PhotonGeocodingService photon,
        BrasilApiCepGeocodingService brasilApiCep,
        ILogger<CompositeGeocodingService> logger)
    {
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
        var providers = new (string Name, Func<Task<GeocodeResult?>> Call)[]
        {
            ("Nominatim", () => _nominatim.GeocodeAsync(cep, logradouro, numero, cidade, uf, ct)),
            ("Photon", () => _photon.GeocodeAsync(cep, logradouro, numero, cidade, uf, ct)),
            ("BrasilAPI-CEP", () => _brasilApiCep.GeocodeAsync(cep, logradouro, numero, cidade, uf, ct)),
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
                _logger.LogInformation("Geocodificação OK via {Provider} → {Lat}, {Lon}", name, result.Latitude, result.Longitude);
                return result;
            }

            _logger.LogDebug("Provedor {Provider} sem resultado", name);
        }

        return null;
    }
}
