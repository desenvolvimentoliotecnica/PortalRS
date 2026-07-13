using RhPortal.Api.Application.Candidatos;
using Xunit;

namespace RHPortal.Api.Tests.Candidatos;

public sealed class CvHeuristicExtractorTests
{
    [Fact]
    public void Extract_reads_core_contact_fields()
    {
        var text = """
            João da Silva Santos
            Nome: João da Silva Santos
            Email: joao.silva@exemplo.com.br
            Celular: (11) 98888-7777
            Telefone: (11) 3333-4444
            LinkedIn: https://www.linkedin.com/in/joao-silva
            Cidade: São Paulo
            UF: SP
            Pretensão salarial: R$ 8.500,00

            Experiência profissional
            ...
            """;

        var r = CvHeuristicExtractor.Extract(text, "cv-joao.pdf");

        Assert.Equal("João da Silva Santos", r.Nome);
        Assert.Equal("joao.silva@exemplo.com.br", r.Email);
        Assert.Equal("(11) 98888-7777", r.Celular);
        Assert.Equal("(11) 3333-4444", r.Fone);
        Assert.Equal("São Paulo", r.Cidade);
        Assert.Equal("SP", r.Uf);
        Assert.Contains("linkedin.com/in/joao-silva", r.LinkedinUrl, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(8500m, r.PretensaoSalarial);
    }

    [Fact]
    public void Extract_falls_back_to_file_name_when_no_name_label()
    {
        var text = """
            Contato
            maria.oliveira@empresa.com
            (21) 99999-0000
            """;

        var r = CvHeuristicExtractor.Extract(text, "Maria_Oliveira_CV.pdf");

        Assert.Equal("maria.oliveira@empresa.com", r.Email);
        Assert.Equal("(21) 99999-0000", r.Celular);
        Assert.Contains("Maria", r.Nome ?? "", StringComparison.OrdinalIgnoreCase);
    }
}
