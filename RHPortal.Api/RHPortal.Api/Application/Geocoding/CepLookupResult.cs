namespace RhPortal.Api.Application.Geocoding;

/// <summary>Endereço canônico retornado pela BrasilAPI CEP v2.</summary>
public sealed record CepLookupResult(
    string CepDigits,
    string? Street,
    string? Neighborhood,
    string? City,
    string? State,
    decimal? Latitude,
    decimal? Longitude);
