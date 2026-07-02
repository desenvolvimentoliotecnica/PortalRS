namespace RhPortal.Api.Application.MicrosoftGraph;

internal static class GraphEmployeeIdVariants
{
    public static IReadOnlyList<string> FromMatriculaRm(string? matriculaRm)
    {
        if (string.IsNullOrWhiteSpace(matriculaRm))
            return Array.Empty<string>();

        var trimmed = matriculaRm.Trim();
        var variants = new List<string> { trimmed };

        if (trimmed.All(char.IsDigit))
        {
            var withoutLeadingZeros = trimmed.TrimStart('0');
            if (!string.IsNullOrEmpty(withoutLeadingZeros) && !variants.Contains(withoutLeadingZeros, StringComparer.Ordinal))
                variants.Add(withoutLeadingZeros);

            var padded = trimmed.PadLeft(8, '0');
            if (!variants.Contains(padded, StringComparer.Ordinal))
                variants.Add(padded);
        }

        return variants;
    }

    public static string EscapeODataLiteral(string value) =>
        value.Replace("'", "''", StringComparison.Ordinal);
}
