namespace RhPortal.Api.Application.IntegracaoTotvs;

/// <summary>
/// Normalizações aplicadas no payload enviado ao TOTVS Progress Datasul.
/// O objetivo é manter o formato amigável na UI/armazenamento, mas expor ao ERP
/// exatamente o que ele espera.
/// </summary>
internal static class TotvsPayloadHelper
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

    /// <summary>Data sem hora no formato ISO <c>yyyy-MM-dd</c>.</summary>
    public static string? FormatDate(DateOnly? date) => date?.ToString("yyyy-MM-dd");

    /// <summary>Data sem hora no formato ISO <c>yyyy-MM-dd</c> (converte UTC para a data do dia em UTC).</summary>
    public static string? FormatDate(DateTimeOffset? dateTime) => dateTime?.UtcDateTime.ToString("yyyy-MM-dd");
}
