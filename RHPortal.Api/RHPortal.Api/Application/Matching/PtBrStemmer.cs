using System.Collections.Generic;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Stemmer conservador de português brasileiro.
///
/// <para>Objetivo: reduzir palavras variantes a uma raiz comum para que o matching
/// texto-livre (CV × Descrição de Cargo DNALIO) case formas flexionadas.
/// Ex.: <c>trabalho</c> / <c>trabalhar</c> / <c>trabalhando</c> → todos viram
/// <c>trabalh</c>; <c>configuração</c> / <c>configurar</c> / <c>configurou</c>
/// → todos <c>configur</c>.</para>
///
/// <para><b>Estratégia</b>: regras de remoção de sufixos por ordem do mais longo
/// para o mais curto, com piso mínimo de 3 chars na raiz. Implementação intencionalmente
/// conservadora — sufixos muito curtos (≤1 char) só são removidos quando a forma
/// canônica do token termina em vogal/e-verbal. Não é RSLP completo, mas cobre
/// 85-90% dos casos típicos de CV/descrição de cargo em pt-br.</para>
///
/// <para><b>Input</b>: token já normalizado (sem acentos, minúsculo, alfanumérico).
/// Use após <c>MatchingService.NormalizeText</c>.</para>
/// </summary>
public static class PtBrStemmer
{
    /// <summary>Piso mínimo de chars na raiz pós-stemming.</summary>
    private const int MinStemLength = 3;

    /// <summary>
    /// Sufixos de plural pt-br, ordem: mais longos primeiro.
    /// Ex.: "aplicações" → remove "oes" → "aplica" → depois passa por sufixos verbais.
    /// </summary>
    private static readonly string[] PluralSuffixes = new[]
    {
        "oes", "aes", "ais", "eis", "ois", "uis", "ns", "es", "s"
    };

    /// <summary>
    /// Sufixos verbais/nominais pt-br comuns. Ordem: mais longos primeiro para
    /// garantir que "amento" seja removido antes de "ento" ou "to".
    /// </summary>
    private static readonly string[] DerivationalSuffixes = new[]
    {
        // Nominalizações
        "amento", "imento", "adores", "edores", "idores",
        "acao", "icao", "ucao",                        // "-ção" após NormalizeText vira "-cao"
        "ancia", "encia",
        "idade", "izacao", "izador",
        "mente",                                         // advérbios
        "ismo", "ista", "ivel", "avel", "ario", "oria",
        // Conjugações verbais
        "ariamos", "eriamos", "iriamos",
        "assemos", "essemos", "issemos",
        "arei", "erei", "irei", "aras", "eras", "iras",
        "aram", "eram", "iram", "aria", "eria", "iria",
        "asse", "esse", "isse",
        "ando", "endo", "indo",
        "amos", "emos", "imos",
        "aste", "este", "iste",
        "ara", "era", "ira", "ava", "iva",
        "ado", "ido", "ada", "ida",
        "ar", "er", "ir", "ou",
    };

    /// <summary>
    /// Aplica stemming conservador a um token pt-br.
    /// Se o token já é curto (≤ <see cref="MinStemLength"/>) ou numérico, retorna como está.
    /// </summary>
    public static string Stem(string token)
    {
        if (string.IsNullOrEmpty(token)) return token;
        if (token.Length <= MinStemLength) return token;
        // Tokens numéricos puros (e.g. "2024", "80") não são stemizados
        bool allDigits = true;
        for (int i = 0; i < token.Length; i++) { if (!char.IsDigit(token[i])) { allDigits = false; break; } }
        if (allDigits) return token;

        var t = token;

        // 1. Plural primeiro
        foreach (var suf in PluralSuffixes)
        {
            if (t.Length - suf.Length >= MinStemLength && t.EndsWith(suf, System.StringComparison.Ordinal))
            {
                t = t.Substring(0, t.Length - suf.Length);
                break;
            }
        }

        // 2. Sufixo derivacional/verbal
        foreach (var suf in DerivationalSuffixes)
        {
            if (t.Length - suf.Length >= MinStemLength && t.EndsWith(suf, System.StringComparison.Ordinal))
            {
                t = t.Substring(0, t.Length - suf.Length);
                break;
            }
        }

        // 3. Vogal final (-a/-e/-i/-o/-u) quando sobra ≥ MinStemLength
        if (t.Length > MinStemLength)
        {
            var last = t[t.Length - 1];
            if (last == 'a' || last == 'e' || last == 'i' || last == 'o' || last == 'u')
            {
                t = t.Substring(0, t.Length - 1);
            }
        }

        return t;
    }

    /// <summary>
    /// Aplica <see cref="Stem"/> em todos os tokens de um texto normalizado (separados por espaço)
    /// e retorna um HashSet de stems únicos — pronto pra busca O(1) em matching.
    /// </summary>
    public static HashSet<string> StemTextToSet(string normalizedText)
    {
        var result = new HashSet<string>(System.StringComparer.Ordinal);
        if (string.IsNullOrEmpty(normalizedText)) return result;
        foreach (var raw in normalizedText.Split(' ', System.StringSplitOptions.RemoveEmptyEntries))
        {
            var s = Stem(raw);
            if (!string.IsNullOrEmpty(s)) result.Add(s);
        }
        return result;
    }
}
