namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Calcula distância "great-circle" entre dois pontos na superfície da Terra
/// usando a fórmula de Haversine. Resultado em quilômetros.
///
/// Usado pelo MatchingService para score de Localidade: distância candidato ×
/// empresa da vaga vira score 0-100 conforme <c>Vaga.LocalidadeMaxDistanciaKm</c>.
///
/// Precisão: ~0.5% para distâncias até 1000km (suficiente pra recrutamento).
/// </summary>
public static class HaversineCalculator
{
    private const double EarthRadiusKm = 6371.0;

    /// <summary>
    /// Distância em km entre (lat1, lon1) e (lat2, lon2).
    /// Coordenadas em graus decimais (WGS84).
    /// </summary>
    public static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusKm * c;
    }

    /// <summary>Sobrecarga aceitando decimal (campos de banco). Converte para double internamente.</summary>
    public static double DistanceKm(decimal lat1, decimal lon1, decimal lat2, decimal lon2)
        => DistanceKm((double)lat1, (double)lon1, (double)lat2, (double)lon2);

    private static double ToRadians(double degrees) => degrees * (Math.PI / 180.0);
}
