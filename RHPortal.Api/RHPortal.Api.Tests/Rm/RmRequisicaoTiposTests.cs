using RhPortal.Api.Infrastructure.Rm;
using Xunit;

namespace RhPortal.Api.Tests.Rm;

public sealed class RmRequisicaoTiposTests
{
    [Theory]
    [InlineData("AUMENTO_QUADRO", true)]
    [InlineData("SUBSTITUICAO", true)]
    [InlineData("DESLIGAMENTO", true)]
    [InlineData("PROMOCAO_ALTERACAO_FUNCIONAL", false)]
    [InlineData("GERAL", false)]
    [InlineData("", false)]
    public void IsVisivelConsulta_RespeitaWhitelist(string tipo, bool esperado)
    {
        Assert.Equal(esperado, RmRequisicaoTipos.IsVisivelConsulta(tipo));
    }

    [Theory]
    [InlineData("AUMENTO_QUADRO", true)]
    [InlineData("SUBSTITUICAO", true)]
    [InlineData("DESLIGAMENTO", false)]
    [InlineData("PROMOCAO_ALTERACAO_FUNCIONAL", false)]
    public void IsImportavelComoSolicitacaoVaga_SomenteAumentoESubstituicao(string tipo, bool esperado)
    {
        Assert.Equal(esperado, RmRequisicaoTipos.IsImportavelComoSolicitacaoVaga(tipo));
    }

    [Fact]
    public void TryParseTipoFromVinculo_ExtraiTipoDoCodigoRm()
    {
        var codigo = RmPortalRequisicaoVinculo.Build("SUBSTITUICAO", 1, 3713);
        Assert.Equal("SUBSTITUICAO", RmRequisicaoTipos.TryParseTipoFromVinculo(codigo));
    }

    [Fact]
    public void FormatCodigoExibicao_UsaTipoEIdReq()
    {
        var codigo = RmPortalRequisicaoVinculo.Build("AUMENTO_QUADRO", 1, 42);
        Assert.Equal("Aumento de Quadro · 42", RmRequisicaoTipos.FormatCodigoExibicao(codigo, null));
    }

    [Theory]
    [InlineData("AUMENTO_QUADRO", "Aumento de Quadro")]
    [InlineData("SUBSTITUICAO", "Substituição")]
    [InlineData("DESLIGAMENTO", "Desligamento")]
    public void FormatLabel_RotulosPtBr(string tipo, string esperado)
    {
        Assert.Equal(esperado, RmRequisicaoTipos.FormatLabel(tipo));
    }
}
