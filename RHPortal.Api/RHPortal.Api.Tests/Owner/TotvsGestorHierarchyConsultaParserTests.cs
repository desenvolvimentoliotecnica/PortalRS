using RhPortal.Api.Application.Owner;
using Xunit;

namespace RhPortal.Api.Tests.Owner;

public sealed class TotvsGestorHierarchyConsultaParserTests
{
    private const string ComChefe = """
[
    {"Coligada":1,"Cód. Posição":25,"Chapa":"00000086","Funcionário":"IVANETE VIEIRA DIAS","ID Hierarquia":912,"Hierarquia Superior":4,"Chefe Superior":"Chefe Hierarquia Superior: 574 - Coligada Chefe: 1 - Chapa:00000595 - Nome: ADRIANO VITOR DOS SANTOS"}
]
""";

    private const string Topo =
        """[{"Coligada":1,"Cód. Posição":1,"Chapa":"00000004","Funcionário":"JULIO SCHWARTZMAN"}]""";

    private const string TopoJsonNullChefe =
        """[{"Coligada":1,"Cód. Posição":1,"Chapa":"00000004","Funcionário":"JULIO SCHWARTZMAN","Chefe Superior":null}]""";

    [Fact]
    public void Parse_ComChefe_ExtraiChapaColigada()
    {
        var r = TotvsGestorHierarchyConsultaParser.Parse(ComChefe);
        Assert.Equal(TotvsGestorHierarchyConsultaParseKind.ChefeIdentificado, r.Kind);
        Assert.Equal(1, r.ChefeColigada);
        Assert.Equal("00000595", r.ChefeChapa);
        Assert.Contains("ADRIANO", r.ChefeNomeRaw ?? "", StringComparison.Ordinal);
        Assert.Equal(912, r.IdHierarquiaRm);
    }

    [Fact]
    public void Parse_SemCampoTopo_Identifica()
    {
        var r = TotvsGestorHierarchyConsultaParser.Parse(Topo);
        Assert.Equal(TotvsGestorHierarchyConsultaParseKind.SemChefeTopo, r.Kind);
        Assert.Null(r.ChefeChapa);
        Assert.Null(r.IdHierarquiaRm);
    }

    [Fact]
    public void Parse_ChefeSuperiorJsonNull_EhTopo()
    {
        var r = TotvsGestorHierarchyConsultaParser.Parse(TopoJsonNullChefe);
        Assert.Equal(TotvsGestorHierarchyConsultaParseKind.SemChefeTopo, r.Kind);
        Assert.Null(r.ChefeChapa);
        Assert.Null(r.IdHierarquiaRm);
    }

    [Fact]
    public void Parse_TopoComIdHierarquia_ExtraiId()
    {
        const string topoComId = """[{"Coligada":1,"Chapa":"00000004","Funcionário":"X","ID Hierarquia":500}]""";
        var r = TotvsGestorHierarchyConsultaParser.Parse(topoComId);
        Assert.Equal(TotvsGestorHierarchyConsultaParseKind.SemChefeTopo, r.Kind);
        Assert.Equal(500, r.IdHierarquiaRm);
    }

    [Fact]
    public void ResolveCodColigada_ParsPad()
    {
        Assert.Equal(1, TotvsGestorHierarchySyncRunner.ResolveCodColigada("01", 9));
        Assert.Equal(11, TotvsGestorHierarchySyncRunner.ResolveCodColigada("11", 1));
    }
}
