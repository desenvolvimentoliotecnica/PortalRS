using RhPortal.Api.Application.Geocoding;
using Xunit;

namespace RhPortal.Api.Tests.Geocoding;

public sealed class CepAddressEnrichmentTests
{
    [Fact]
    public void ParseStreet_separa_numero_no_final_da_BrasilAPI()
    {
        var (logradouro, numero) = CepAddressEnrichment.ParseStreet("Avenida João Paulo I 900", "900");

        Assert.Equal("Avenida João Paulo I", logradouro);
        Assert.Equal("900", numero);
    }

    [Fact]
    public void ParseStreet_extrai_numero_quando_nao_informado()
    {
        var (logradouro, numero) = CepAddressEnrichment.ParseStreet("Avenida João Paulo I 900", null);

        Assert.Equal("Avenida João Paulo I", logradouro);
        Assert.Equal("900", numero);
    }

    [Fact]
    public void Apply_prefere_logradouro_canonico_da_BrasilAPI()
    {
        var lookup = new CepLookupResult(
            "06818901",
            "Avenida João Paulo I 900",
            "Jardim Santa Bárbara",
            "Embu das Artes",
            "SP",
            null,
            null);

        var enriched = CepAddressEnrichment.Apply(
            "06818-901",
            "JOAO PAULO I",
            "900",
            "DAS OLIVEIRAS",
            "Embu das Artes",
            "SP",
            lookup);

        Assert.Equal("06818-901", enriched.Cep);
        Assert.Equal("Avenida João Paulo I", enriched.Logradouro);
        Assert.Equal("900", enriched.Numero);
        Assert.Equal("Embu das Artes", enriched.Cidade);
        Assert.Equal("SP", enriched.Uf);
    }

    [Fact]
    public void Apply_mantem_endereco_original_quando_lookup_e_null()
    {
        var enriched = CepAddressEnrichment.Apply(
            "06818-901",
            "JOAO PAULO I",
            "900",
            null,
            "Embu das Artes",
            "SP",
            lookup: null);

        Assert.Equal("JOAO PAULO I", enriched.Logradouro);
        Assert.Equal("900", enriched.Numero);
    }

    [Theory]
    [InlineData("{\"location\":{\"coordinates\":[-46.82,-23.64]}}", true, -23.64, -46.82)]
    [InlineData("{\"location\":{\"coordinates\":{\"latitude\":-23.64,\"longitude\":-46.82}}}", true, -23.64, -46.82)]
    [InlineData("{\"location\":{\"coordinates\":{}}}", false, 0, 0)]
    public void TryParseCoordinates_suporta_formatos_GeoJSON(
        string json,
        bool expectedOk,
        double expectedLat,
        double expectedLon)
    {
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var location = doc.RootElement.GetProperty("location");

        var ok = BrasilApiCepLookupService.TryParseCoordinates(location, out var lat, out var lon);

        Assert.Equal(expectedOk, ok);
        if (expectedOk)
        {
            Assert.Equal((decimal)expectedLat, lat);
            Assert.Equal((decimal)expectedLon, lon);
        }
    }
}
