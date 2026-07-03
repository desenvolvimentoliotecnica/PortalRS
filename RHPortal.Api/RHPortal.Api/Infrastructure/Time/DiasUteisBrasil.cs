namespace RhPortal.Api.Infrastructure.Time;

/// <summary>
/// Contagem de dias úteis (seg–sex, excluindo feriados nacionais brasileiros).
/// </summary>
public static class DiasUteisBrasil
{
    /// <summary>
    /// Dias úteis decorridos desde a abertura até <paramref name="ate"/> (exclusive do dia de abertura).
    /// Ex.: abriu segunda, consulta segunda = 0; consulta terça = 1.
    /// </summary>
    public static int ContarDiasUteisDecorridos(DateTimeOffset abertura, DateTimeOffset ate)
    {
        var inicio = DateOnly.FromDateTime(abertura.Date);
        var fim = DateOnly.FromDateTime(ate.Date);
        if (fim <= inicio)
            return 0;

        var feriados = ObterFeriadosNacionais(inicio.Year, fim.Year);
        var count = 0;
        for (var d = inicio.AddDays(1); d <= fim; d = d.AddDays(1))
        {
            if (EhDiaUtil(d, feriados))
                count++;
        }

        return count;
    }

    public static bool EhDiaUtil(DateOnly data, HashSet<DateOnly>? feriadosCache = null)
    {
        if (data.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            return false;

        feriadosCache ??= ObterFeriadosNacionais(data.Year, data.Year);
        return !feriadosCache.Contains(data);
    }

    public static HashSet<DateOnly> ObterFeriadosNacionais(int anoInicio, int anoFim)
    {
        var set = new HashSet<DateOnly>();
        for (var ano = anoInicio; ano <= anoFim; ano++)
        {
            foreach (var f in FeriadosDoAno(ano))
                set.Add(f);
        }

        return set;
    }

    private static IEnumerable<DateOnly> FeriadosDoAno(int ano)
    {
        yield return new DateOnly(ano, 1, 1);   // Confraternização
        yield return new DateOnly(ano, 4, 21);  // Tiradentes
        yield return new DateOnly(ano, 5, 1);   // Trabalho
        yield return new DateOnly(ano, 9, 7);   // Independência
        yield return new DateOnly(ano, 10, 12); // Nossa Senhora Aparecida
        yield return new DateOnly(ano, 11, 2);  // Finados
        yield return new DateOnly(ano, 11, 15); // Proclamação da República
        yield return new DateOnly(ano, 12, 25); // Natal

        var pascoa = CalcularPascoa(ano);
        yield return pascoa.AddDays(-48); // Segunda de Carnaval
        yield return pascoa.AddDays(-47); // Terça de Carnaval
        yield return pascoa.AddDays(-2);  // Sexta-feira Santa
        yield return pascoa.AddDays(60);  // Corpus Christi
    }

    /// <summary>Algoritmo de Meeus/Jones/Butcher (Gregoriano).</summary>
    internal static DateOnly CalcularPascoa(int ano)
    {
        var a = ano % 19;
        var b = ano / 100;
        var c = ano % 100;
        var d = b / 4;
        var e = b % 4;
        var f = (b + 8) / 25;
        var g = (b - f + 1) / 3;
        var h = (19 * a + b - d - g + 15) % 30;
        var i = c / 4;
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = (a + 11 * h + 22 * l) / 451;
        var mes = (h + l - 7 * m + 114) / 31;
        var dia = ((h + l - 7 * m + 114) % 31) + 1;
        return new DateOnly(ano, mes, dia);
    }
}
