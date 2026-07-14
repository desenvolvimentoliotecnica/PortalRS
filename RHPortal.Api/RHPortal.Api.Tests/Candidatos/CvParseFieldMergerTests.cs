using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Application.Talentos;
using Xunit;

namespace RHPortal.Api.Tests.Candidatos;

public sealed class CvParseFieldMergerTests
{
    [Fact]
    public void FromAi_maps_all_fields_and_trims_glued_email()
    {
        var ai = new CvNovoCandidatoAiData(
            "Alexandre Guerreiro Sparapan",
            "alegspa@hotmail.comObjetivoAtuar",
            "(11) 3333-4444",
            "(11) 98481-4184",
            "São Paulo",
            "SP",
            "https://linkedin.com/in/alexandre",
            8500m,
            true,
            "Resumo do candidato e fit para a vaga.");

        var result = CvParseFieldMerger.FromAi("texto cv", ai, "{...}", aiTentou: true, null);

        Assert.True(result.Sucesso);
        Assert.Equal(CvParseFieldMerger.FonteAi, result.Fonte);
        Assert.Equal("Alexandre Guerreiro Sparapan", result.Nome);
        Assert.Equal("alegspa@hotmail.com", result.Email);
        Assert.Equal("(11) 3333-4444", result.Fone);
        Assert.Equal("(11) 98481-4184", result.Celular);
        Assert.Equal("São Paulo", result.Cidade);
        Assert.Equal("SP", result.Uf);
        Assert.Equal(8500m, result.PretensaoSalarial);
        Assert.True(result.TrabalhandoAtualmente);
        Assert.Contains("fit", result.Observacoes, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void FromAi_without_data_returns_error()
    {
        var result = CvParseFieldMerger.FromAi(
            "cv", null, null, aiTentou: true, "IA offline");

        Assert.False(result.Sucesso);
        Assert.Equal(CvParseFieldMerger.FonteError, result.Fonte);
        Assert.Equal("IA offline", result.AiErro);
        Assert.Null(result.Nome);
    }
}
