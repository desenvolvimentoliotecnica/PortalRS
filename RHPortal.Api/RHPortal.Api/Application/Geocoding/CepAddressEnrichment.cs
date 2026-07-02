using System.Text.RegularExpressions;

namespace RhPortal.Api.Application.Geocoding;

/// <summary>
/// Combina endereço informado pelo usuário/RM com dados canônicos do CEP (BrasilAPI)
/// antes de consultar Nominatim/Photon — corrige logradouros abreviados (ex.: "JOAO PAULO I"
/// → "Avenida João Paulo I").
/// </summary>
public static partial class CepAddressEnrichment
{
    public readonly record struct GeocodeAddress(
        string? Cep,
        string? Logradouro,
        string? Numero,
        string? Bairro,
        string? Cidade,
        string? Uf);

    public static GeocodeAddress Apply(
        string? cep,
        string? logradouro,
        string? numero,
        string? bairro,
        string? cidade,
        string? uf,
        CepLookupResult? lookup)
    {
        if (lookup is null)
        {
            return new GeocodeAddress(
                NullIfBlank(cep),
                NullIfBlank(logradouro),
                NullIfBlank(numero),
                NullIfBlank(bairro),
                NullIfBlank(cidade),
                NullIfBlank(uf));
        }

        var (parsedLogradouro, parsedNumero) = ParseStreet(lookup.Street, numero);

        return new GeocodeAddress(
            Cep: NullIfBlank(cep) ?? lookup.CepDigits,
            Logradouro: parsedLogradouro ?? NullIfBlank(logradouro),
            Numero: NullIfBlank(numero) ?? parsedNumero,
            Bairro: NullIfBlank(bairro) ?? NullIfBlank(lookup.Neighborhood),
            Cidade: NullIfBlank(cidade) ?? NullIfBlank(lookup.City),
            Uf: NullIfBlank(uf) ?? NullIfBlank(lookup.State));
    }

    /// <summary>
    /// Separa logradouro e número quando a BrasilAPI devolve "Avenida X 900" no campo street.
    /// </summary>
    internal static (string? Logradouro, string? Numero) ParseStreet(string? street, string? numeroInformado)
    {
        if (string.IsNullOrWhiteSpace(street))
            return (null, NullIfBlank(numeroInformado));

        var trimmed = street.Trim();
        var numero = NullIfBlank(numeroInformado);

        if (numero is not null &&
            trimmed.EndsWith(numero, StringComparison.OrdinalIgnoreCase))
        {
            var logradouro = trimmed[..^numero.Length].Trim().TrimEnd(',');
            return (NullIfBlank(logradouro), numero);
        }

        var match = TrailingStreetNumberRegex().Match(trimmed);
        if (match.Success)
        {
            var log = NullIfBlank(match.Groups[1].Value);
            var num = NullIfBlank(match.Groups[2].Value);
            return (log, numero ?? num);
        }

        return (NullIfBlank(trimmed), numero);
    }

    internal static string? NullIfBlank(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^(.+?)\s+(\d+[A-Za-z]?-?\d*)$", RegexOptions.CultureInvariant)]
    private static partial Regex TrailingStreetNumberRegex();
}
