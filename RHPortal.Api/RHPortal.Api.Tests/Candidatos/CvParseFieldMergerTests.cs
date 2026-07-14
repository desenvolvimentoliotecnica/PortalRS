using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Contracts.Talentos;
using Xunit;

namespace RHPortal.Api.Tests.Candidatos;

public sealed class CvParseFieldMergerTests
{
    [Fact]
    public void Merge_prefers_ai_and_fills_pretensao_from_heuristic()
    {
        var ai = new TalentoImportPdfSuggestedData(
            "Mariana Costa Almeida",
            "mariana.almeida@email.com",
            "(11) 90000-0000",
            "São Paulo",
            "SP",
            "https://linkedin.com/in/marianaalmeid",
            null, null, null, null, null, null, null, null,
            Array.Empty<TalentoCompetenciaItem>(),
            Array.Empty<TalentoExperienciaItem>(),
            Array.Empty<TalentoTreinamentoItem>(),
            Array.Empty<TalentoFormacaoItem>());

        var h = new CvHeuristicExtractor.Result(
            "Nome Errado Heuristica",
            "errado@email.com",
            "(11) 3333-4444",
            "(11) 98888-7777",
            "Guarulhos",
            "SP",
            null,
            5500m);

        var merged = CvParseFieldMerger.Merge("texto cv", ai, h);

        Assert.Equal(CvParseFieldMerger.FonteAi, merged.Fonte);
        Assert.Equal("Mariana Costa Almeida", merged.Nome);
        Assert.Equal("mariana.almeida@email.com", merged.Email);
        Assert.Equal("(11) 90000-0000", merged.Celular);
        Assert.Equal("(11) 3333-4444", merged.Fone);
        Assert.Equal("São Paulo", merged.Cidade);
        Assert.Equal("SP", merged.Uf);
        Assert.Contains("linkedin.com/in/marianaalmeid", merged.LinkedinUrl, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(5500m, merged.PretensaoSalarial);
    }

    [Fact]
    public void Merge_without_ai_uses_heuristic_fonte()
    {
        var h = new CvHeuristicExtractor.Result(
            "João da Silva",
            "joao@exemplo.com",
            null,
            "(11) 98888-7777",
            "São Paulo",
            "SP",
            null,
            null);

        var merged = CvParseFieldMerger.Merge("cv", null, h);

        Assert.Equal(CvParseFieldMerger.FonteHeuristic, merged.Fonte);
        Assert.Equal("João da Silva", merged.Nome);
        Assert.Equal("joao@exemplo.com", merged.Email);
        Assert.Equal("(11) 98888-7777", merged.Celular);
    }
}
