using System.Globalization;
using System.Text.RegularExpressions;

namespace RhPortal.Api.Application.Candidatos;

/// <summary>
/// Extrai campos estruturados de texto de currículo de forma determinística (sem LLM).
/// </summary>
public static class CvHeuristicExtractor
{
    private static readonly Regex EmailRegex = new(
        @"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex LinkedInRegex = new(
        @"https?://(?:www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex PhoneCandidateRegex = new(
        @"(?:(?:\+|00)\s*55[\s\-.]*)?(?:\(?\d{2}\)?[\s\-.]*)?(?:9\d{4}|\d{4})[\s\-.]?\d{4}",
        RegexOptions.Compiled);

    private static readonly Regex DigitsOnly = new(@"\D", RegexOptions.Compiled);

    private static readonly Regex LabeledNameRegex = new(
        @"(?im)^\s*(?:nome(?:\s+completo)?|name)\s*[:\-]\s*(.+)$",
        RegexOptions.Compiled);

    private static readonly Regex LabeledCityRegex = new(
        @"(?im)^\s*(?:cidade|city|local(?:idade)?|munic[ií]pio)\s*[:\-]\s*(.+)$",
        RegexOptions.Compiled);

    private static readonly Regex LabeledUfRegex = new(
        @"(?im)^\s*(?:uf|estado|state)\s*[:\-]\s*([A-Za-z]{2})\b",
        RegexOptions.Compiled);

    private static readonly Regex CityUfInlineRegex = new(
        @"(?im)^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{1,40}?)\s*[-–/,]\s*([A-Z]{2})\s*$",
        RegexOptions.Compiled);

    private static readonly Regex PretensaoRegex = new(
        @"(?is)(?:pretens[aã]o(?:\s+salarial)?|sal[aá]rio\s+desejado|expectativa\s+salarial)[^\dR$]{0,40}(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{4,7}(?:,\d{2})?|\d{1,7}(?:,\d{2})|\d{1,7}(?:\.\d{2})?)",
        RegexOptions.Compiled);

    private static readonly HashSet<string> ValidUfs = new(StringComparer.OrdinalIgnoreCase)
    {
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
        "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
    };

    private static readonly HashSet<string> NameStopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "curriculo", "currículo", "curriculum", "vitae", "cv", "resumo", "objetivo",
        "experiencia", "experiência", "formacao", "formação", "educacao", "educação",
        "contato", "dados", "pessoais", "profissional", "habilidades", "idiomas"
    };

    public sealed record Result(
        string? Nome,
        string? Email,
        string? Fone,
        string? Celular,
        string? Cidade,
        string? Uf,
        string? LinkedinUrl,
        decimal? PretensaoSalarial);

    public static Result Extract(string? cvText, string? fileName = null)
    {
        var text = cvText ?? string.Empty;
        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrWhiteSpace(fileName))
            return new Result(null, null, null, null, null, null, null, null);

        var email = ExtractEmail(text);
        var linkedin = ExtractLinkedIn(text);
        var (fone, celular) = ExtractPhones(text);
        var uf = ExtractUf(text);
        var cidade = ExtractCidade(text, uf);
        var nome = ExtractNome(text) ?? GuessNameFromFile(fileName, email);
        var pretensao = ExtractPretensao(text);

        return new Result(nome, email, fone, celular, cidade, uf, linkedin, pretensao);
    }

    private static string? ExtractEmail(string text)
        => EmailRegex.Matches(text).Select(m => m.Value.Trim()).FirstOrDefault(e => e.Length >= 5);

    private static string? ExtractLinkedIn(string text)
    {
        var m = LinkedInRegex.Match(text);
        if (!m.Success) return null;
        var url = m.Value.Trim().TrimEnd('/');
        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = "https://" + url;
        return url.Length > 260 ? url[..260] : url;
    }

    private static (string? Fone, string? Celular) ExtractPhones(string text)
    {
        var phones = new List<(string Formatted, string Digits, bool IsMobile)>();
        foreach (Match m in PhoneCandidateRegex.Matches(text))
        {
            var raw = m.Value;
            var digits = DigitsOnly.Replace(raw, "");
            if (digits.StartsWith("55") && digits.Length >= 12)
                digits = digits[2..];
            if (digits.Length is < 10 or > 11)
                continue;

            var isMobile = digits.Length == 11 && digits[2] == '9';
            var formatted = FormatBrPhone(digits);
            if (phones.Any(p => p.Digits == digits))
                continue;
            phones.Add((formatted, digits, isMobile));
        }

        string? celular = phones.FirstOrDefault(p => p.IsMobile).Formatted;
        string? fone = phones.FirstOrDefault(p => !p.IsMobile).Formatted;

        if (celular is null && phones.Count > 0)
            celular = phones[0].Formatted;
        if (fone is null && phones.Count > 1)
            fone = phones.FirstOrDefault(p => p.Formatted != celular).Formatted;

        return (fone, celular);
    }

    private static string FormatBrPhone(string digits)
    {
        if (digits.Length == 11)
            return $"({digits[..2]}) {digits[2..7]}-{digits[7..]}";
        if (digits.Length == 10)
            return $"({digits[..2]}) {digits[2..6]}-{digits[6..]}";
        return digits;
    }

    private static string? ExtractNome(string text)
    {
        var labeled = LabeledNameRegex.Match(text);
        if (labeled.Success)
        {
            var v = CleanNameCandidate(labeled.Groups[1].Value);
            if (v is not null) return v;
        }

        var lines = text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var scanned = 0;
        foreach (var line in lines)
        {
            if (scanned >= 12) break;
            scanned++;
            if (line.Contains('@') || line.Contains("http", StringComparison.OrdinalIgnoreCase))
                continue;
            if (PhoneCandidateRegex.IsMatch(line))
                continue;

            var candidate = CleanNameCandidate(line);
            if (candidate is null) continue;
            return candidate;
        }

        return null;
    }

    private static string? CleanNameCandidate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        s = Regex.Replace(s, @"\s+", " ");
        // strip trailing role titles after | or —
        var cut = Regex.Split(s, @"\s*[|–—]\s*")[0].Trim();
        if (cut.Length is < 3 or > 160) return null;

        var words = cut.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length is < 2 or > 6) return null;
        if (words.Any(w => NameStopWords.Contains(w))) return null;
        if (words.Any(w => w.Any(char.IsDigit))) return null;
        if (!words.All(w => w.Length >= 1 && char.IsLetter(w[0]))) return null;

        return cut;
    }

    private static string? ExtractUf(string text)
    {
        var labeled = LabeledUfRegex.Match(text);
        if (labeled.Success)
        {
            var uf = labeled.Groups[1].Value.Trim().ToUpperInvariant();
            if (ValidUfs.Contains(uf)) return uf;
        }

        var inline = CityUfInlineRegex.Match(text);
        if (inline.Success)
        {
            var uf = inline.Groups[2].Value.Trim().ToUpperInvariant();
            if (ValidUfs.Contains(uf)) return uf;
        }

        // Prefer explicit "Cidade - UF" already handled; last resort scan first 2KB for " - XX"
        var dashUf = Regex.Matches(text.Length > 2500 ? text[..2500] : text, @"[-–/]\s*([A-Z]{2})\b");
        foreach (Match m in dashUf)
        {
            var uf = m.Groups[1].Value;
            if (ValidUfs.Contains(uf)) return uf;
        }

        return null;
    }

    private static string? ExtractCidade(string text, string? uf)
    {
        var labeled = LabeledCityRegex.Match(text);
        if (labeled.Success)
        {
            var raw = labeled.Groups[1].Value.Trim();
            raw = Regex.Replace(raw, @"\s*[-–/,]\s*[A-Za-z]{2}\s*$", "").Trim();
            if (raw.Length is >= 2 and <= 120) return Truncate(raw, 120);
        }

        var inline = CityUfInlineRegex.Match(text);
        if (inline.Success)
        {
            var city = inline.Groups[1].Value.Trim();
            if (city.Length is >= 2 and <= 120) return Truncate(city, 120);
        }

        if (!string.IsNullOrWhiteSpace(uf))
        {
            var pattern = $@"(?im)^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.]{{1,40}}?)\s*[-–/,]\s*{Regex.Escape(uf)}\s*$";
            var m = Regex.Match(text, pattern);
            if (m.Success)
            {
                var city = m.Groups[1].Value.Trim();
                if (city.Length is >= 2 and <= 120) return Truncate(city, 120);
            }
        }

        return null;
    }

    private static decimal? ExtractPretensao(string text)
    {
        var m = PretensaoRegex.Match(text);
        if (!m.Success) return null;

        var raw = m.Groups[1].Value.Trim();
        // BR: 5.000,00 or 5000 or 5.000
        if (raw.Contains(',') && raw.Contains('.'))
            raw = raw.Replace(".", "").Replace(',', '.');
        else if (raw.Contains(','))
            raw = raw.Replace(',', '.');
        else if (Regex.IsMatch(raw, @"^\d{1,3}(\.\d{3})+$"))
            raw = raw.Replace(".", "");

        if (decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
            && value is > 0 and < 1_000_000)
            return Math.Round(value, 2);

        return null;
    }

    private static string? GuessNameFromFile(string? fileName, string? email)
    {
        if (!string.IsNullOrWhiteSpace(fileName))
        {
            var baseName = Path.GetFileNameWithoutExtension(fileName)
                ?.Replace('_', ' ')
                .Replace('-', ' ')
                .Trim();
            if (!string.IsNullOrWhiteSpace(baseName))
            {
                baseName = Regex.Replace(baseName, @"\b(cv|curriculo|currículo|curriculum|vitae)\b", "", RegexOptions.IgnoreCase);
                baseName = Regex.Replace(baseName, @"\s+", " ").Trim();
                var cleaned = CleanNameCandidate(baseName);
                if (cleaned is not null) return cleaned;
                if (baseName.Length is >= 3 and <= 160 && !baseName.Any(char.IsDigit))
                    return Truncate(baseName, 160);
            }
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            var prefix = email.Split('@')[0]
                .Replace('.', ' ')
                .Replace('_', ' ')
                .Replace('-', ' ')
                .Trim();
            prefix = Regex.Replace(prefix, @"\d+", "").Trim();
            prefix = Regex.Replace(prefix, @"\s+", " ");
            if (prefix.Length >= 3)
            {
                var words = prefix.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (words.Length >= 2)
                    return Truncate(string.Join(' ', words.Select(Capitalize)), 160);
            }
        }

        return null;
    }

    private static string Capitalize(string w)
        => string.IsNullOrEmpty(w) ? w : char.ToUpperInvariant(w[0]) + w[1..].ToLowerInvariant();

    private static string Truncate(string s, int max)
        => s.Length <= max ? s : s[..max];
}
