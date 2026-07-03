using RhPortal.Api.Infrastructure.Time;
using Xunit;

namespace RHPortal.Api.Tests.Time;

public sealed class DiasUteisBrasilTests
{
    [Fact]
    public void ContarDiasUteis_SegundaParaTerca_Retorna1()
    {
        var abertura = new DateTimeOffset(2026, 7, 6, 10, 0, 0, TimeSpan.Zero); // segunda
        var ate = new DateTimeOffset(2026, 7, 7, 18, 0, 0, TimeSpan.Zero); // terça
        Assert.Equal(1, DiasUteisBrasil.ContarDiasUteisDecorridos(abertura, ate));
    }

    [Fact]
    public void ContarDiasUteis_MesmoDia_Retorna0()
    {
        var dia = new DateTimeOffset(2026, 7, 6, 9, 0, 0, TimeSpan.Zero);
        Assert.Equal(0, DiasUteisBrasil.ContarDiasUteisDecorridos(dia, dia));
    }

    [Fact]
    public void ContarDiasUteis_SextaParaSegunda_Retorna1()
    {
        var abertura = new DateTimeOffset(2026, 7, 3, 9, 0, 0, TimeSpan.Zero); // sexta
        var ate = new DateTimeOffset(2026, 7, 6, 9, 0, 0, TimeSpan.Zero); // segunda
        Assert.Equal(1, DiasUteisBrasil.ContarDiasUteisDecorridos(abertura, ate));
    }

    [Fact]
    public void EhDiaUtil_Natal_RetornaFalse()
    {
        Assert.False(DiasUteisBrasil.EhDiaUtil(new DateOnly(2026, 12, 25)));
    }
}
