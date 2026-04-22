namespace RhPortal.Api.Application.IntegracaoTotvs;

/// <summary>
/// Normalizações aplicadas no payload enviado ao TOTVS Progress Datasul.
/// O objetivo é manter o formato amigável na UI/armazenamento, mas expor ao ERP
/// exatamente o que ele espera.
/// </summary>
public static class TotvsPayloadHelper
{
    /// <summary>
    /// CPF/CNPJ/CEP etc.: TOTVS aceita apenas dígitos, sem pontos, traços ou barras.
    /// </summary>
    public static string? OnlyDigits(string? value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        Span<char> buffer = stackalloc char[value.Length];
        var i = 0;
        foreach (var c in value)
            if (c >= '0' && c <= '9') buffer[i++] = c;
        return i == 0 ? null : new string(buffer[..i]);
    }

    /// <summary>
    /// Peso é armazenado em kg (inteiro) pela UI, mas o TOTVS exige gramas.
    /// </summary>
    public static int? PesoKgParaGramas(int? pesoKg) => pesoKg.HasValue ? pesoKg.Value * 1000 : null;

    /// <summary>
    /// Extrai apenas o número do telefone, removendo máscara e o DDD se vier junto.
    /// Brasileiro: 10 dígitos = DDD(2)+fixo(8); 11 dígitos = DDD(2)+celular(9).
    /// O DDD deve ir nos campos separados <c>dddTelefone</c>/<c>dddTelContato</c>.
    /// </summary>
    public static string? PhoneOnlyNumber(string? phone)
    {
        var digits = OnlyDigits(phone);
        if (string.IsNullOrEmpty(digits)) return null;
        // 10 ou 11 dígitos → tem DDD colado, remove os 2 primeiros.
        return digits.Length >= 10 ? digits[2..] : digits;
    }

    /// <summary>Data no formato ISO <c>yyyy-MM-dd</c>.</summary>
    public static string? FormatDate(DateOnly? date) =>
        date?.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>Data (instante UTC convertido para o dia calendário) no formato ISO <c>yyyy-MM-dd</c>.</summary>
    public static string? FormatDate(DateTimeOffset? dateTime) =>
        dateTime?.UtcDateTime.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>
    /// Data no formato brasileiro compacto <c>ddMMyyyy</c> (sem separadores) —
    /// usado pelo TOTVS Datasul na API <c>apisfrescisao.p</c> (rescisão/desligamento).
    /// Retorna string vazia quando data é nula (Datasul aceita "" como "sem data").
    /// </summary>
    /// <example>DateOnly(2026,4,16) → "16042026"</example>
    public static string FormatDateBr(DateOnly? date) =>
        date?.ToString("ddMMyyyy", System.Globalization.CultureInfo.InvariantCulture) ?? "";

    public static string FormatDateBr(DateTimeOffset? dateTime) =>
        dateTime?.UtcDateTime.ToString("ddMMyyyy", System.Globalization.CultureInfo.InvariantCulture) ?? "";

    /// <summary>
    /// Converte data legada armazenada como int no formato <c>ddMMyyyy</c> para ISO <c>yyyy-MM-dd</c>.
    /// Retorna null se o valor for 0, nulo ou não puder ser parseado.
    /// </summary>
    /// <example>30082021 → "2021-08-30"</example>
    public static string? FormatIntDate(int? legacyDate)
    {
        if (!legacyDate.HasValue || legacyDate.Value <= 0) return null;
        var s = legacyDate.Value.ToString("D8", System.Globalization.CultureInfo.InvariantCulture);
        if (s.Length != 8) return null;
        if (!int.TryParse(s[..2], out var d) || !int.TryParse(s[2..4], out var m) || !int.TryParse(s[4..], out var y))
            return null;
        try { return new DateOnly(y, m, d).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture); }
        catch { return null; }
    }
}
