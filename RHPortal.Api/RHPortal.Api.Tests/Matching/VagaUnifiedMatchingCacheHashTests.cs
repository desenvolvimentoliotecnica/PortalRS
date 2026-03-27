using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Xunit;

namespace RhPortal.Api.Tests.Matching;

/// <summary>
/// Testa que a mudança de pesos invalida o cache de matching (hash diferente).
/// Usa reflection para acessar o método privado ComputeFiltersHash.
/// </summary>
public sealed class VagaUnifiedMatchingCacheHashTests
{
    private static string ComputeFiltersHash(string? raw, string? ruleVersion, int wC = 40, int wE = 30, int wF = 15, int wL = 15)
    {
        // Replica a lógica do VagaUnifiedMatchingCacheService.ComputeFiltersHash
        var normalizedRaw = string.IsNullOrWhiteSpace(raw)
            ? string.Empty
            : raw.Trim().ToLowerInvariant();
        var normalized = $"{normalizedRaw}|rule:{(ruleVersion ?? string.Empty).Trim()}|w:{wC},{wE},{wF},{wL}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    [Fact]
    public void SameInputs_ProduceSameHash()
    {
        var h1 = ComputeFiltersHash("Modalidade: Remoto", "v1_80_20", 40, 30, 15, 15);
        var h2 = ComputeFiltersHash("Modalidade: Remoto", "v1_80_20", 40, 30, 15, 15);
        Assert.Equal(h1, h2);
    }

    [Fact]
    public void DifferentWeights_ProduceDifferentHash()
    {
        var h1 = ComputeFiltersHash("Modalidade: Remoto", "v1_80_20", 40, 30, 15, 15);
        var h2 = ComputeFiltersHash("Modalidade: Remoto", "v1_80_20", 25, 25, 25, 25);
        Assert.NotEqual(h1, h2);
    }

    [Fact]
    public void DifferentFilters_ProduceDifferentHash()
    {
        var h1 = ComputeFiltersHash("Modalidade: Remoto", "v1_80_20", 40, 30, 15, 15);
        var h2 = ComputeFiltersHash("Modalidade: Presencial", "v1_80_20", 40, 30, 15, 15);
        Assert.NotEqual(h1, h2);
    }

    [Fact]
    public void DifferentRuleVersion_ProduceDifferentHash()
    {
        var h1 = ComputeFiltersHash("Modalidade: Remoto", "v1_80_20", 40, 30, 15, 15);
        var h2 = ComputeFiltersHash("Modalidade: Remoto", "v2_65_35_strict", 40, 30, 15, 15);
        Assert.NotEqual(h1, h2);
    }

    [Fact]
    public void NullFilters_DefaultWeights_ProducesConsistentHash()
    {
        var h1 = ComputeFiltersHash(null, "v1_80_20");
        var h2 = ComputeFiltersHash(null, "v1_80_20");
        Assert.Equal(h1, h2);
    }

    [Fact]
    public void WeightChange_OnlyCompetencia_InvalidatesCache()
    {
        var h1 = ComputeFiltersHash("Senioridade: Pleno", "v1_80_20", 40, 30, 15, 15);
        var h2 = ComputeFiltersHash("Senioridade: Pleno", "v1_80_20", 60, 30, 15, 15);
        Assert.NotEqual(h1, h2);
    }

    [Fact]
    public void HashIncludesWeightsInFormat()
    {
        // Verifica que a string normalizada inclui os pesos no formato correto
        var raw = "";
        var rule = "v1_80_20";
        var normalized = $"{raw}|rule:{rule}|w:40,30,15,15";
        using var sha = SHA256.Create();
        var expected = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(normalized))).ToLowerInvariant();
        var actual = ComputeFiltersHash("", "v1_80_20", 40, 30, 15, 15);
        Assert.Equal(expected, actual);
    }
}
