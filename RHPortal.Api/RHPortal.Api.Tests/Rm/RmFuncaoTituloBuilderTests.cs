using RhPortal.Api.Infrastructure.Rm;
using Xunit;

namespace RhPortal.Api.Tests.Rm;

public sealed class RmFuncaoTituloBuilderTests
{
    [Fact]
    public void Build_ComCodigoENome_RetornaFormatoRm()
    {
        var titulo = RmFuncaoTituloBuilder.Build("879", "OPERADOR PRODUÇÃO", null);
        Assert.Equal("879 - OPERADOR PRODUÇÃO", titulo);
    }

    [Fact]
    public void Build_UsaDescricaoFuncaoQuandoNomeAusente()
    {
        var titulo = RmFuncaoTituloBuilder.Build("879", null, "OPERADOR PRODUÇÃO");
        Assert.Equal("879 - OPERADOR PRODUÇÃO", titulo);
    }

    [Fact]
    public void Build_SemCodigo_RetornaHifen()
    {
        Assert.Equal("-", RmFuncaoTituloBuilder.Build(null, "OPERADOR PRODUÇÃO", null));
    }

    [Fact]
    public void Build_SemNome_RetornaHifen()
    {
        Assert.Equal("-", RmFuncaoTituloBuilder.Build("879", null, null));
    }

    [Fact]
    public void Build_NomeJaFormatado_NaoDuplicaCodigo()
    {
        var titulo = RmFuncaoTituloBuilder.Build("879", "879 - OPERADOR PRODUÇÃO", null);
        Assert.Equal("879 - OPERADOR PRODUÇÃO", titulo);
    }
}
