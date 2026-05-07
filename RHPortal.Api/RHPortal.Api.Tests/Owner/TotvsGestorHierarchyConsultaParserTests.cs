using RhPortal.Api.Application.Owner;
using Xunit;

namespace RhPortal.Api.Tests.Owner;

public sealed class TotvsGestorHierarchyConsultaParserTests
{
    private const string ComChefe = """
[
    {"Coligada":1,"Cód. Posição":25,"Chapa":"00000086","Funcionário":"IVANETE VIEIRA DIAS","Hierarquia Superior":4,"Chefe Superior":"Chefe Hierarquia Superior: 574 - Coligada Chefe: 1 - Chapa:00000595 - Nome: ADRIANO VITOR DOS SANTOS"}
]
""";

    private const string Topo =
        """[{"Coligada":1,"Cód. Posição":1,"Chapa":"00000004","Funcionário":"JULIO SCHWARTZMAN"}]""";

    [Fact]
    public void Parse_ComChefe_ExtraiChapaColigada()
    {
        var r = TotvsGestorHierarchyConsultaParser.Parse(ComChefe);
        Assert.Equal(TotvsGestorHierarchyConsultaParseKind.ChefeIdentificado, r.Kind);
        Assert.Equal(1, r.ChefeColigada);
        Assert.Equal("00000595", r.ChefeChapa);
        Assert.Contains("ADRIANO", r.ChefeNomeRaw ?? "", StringComparison.Ordinal);
    }

    [Fact]
    public void Parse_SemCampoTopo_Identifica()
    {
        var r = TotvsGestorHierarchyConsultaParser.Parse(Topo);
        Assert.Equal(TotvsGestorHierarchyConsultaParseKind.SemChefeTopo, r.Kind);
        Assert.Null(r.ChefeChapa);
    }

    [Fact]
    public void ResolveCodColigada_ParsPad()
    {
        Assert.Equal(1, TotvsGestorHierarchySyncRunner.ResolveCodColigada("01", 9));
        Assert.Equal(11, TotvsGestorHierarchySyncRunner.ResolveCodColigada("11", 1));
    }
}
