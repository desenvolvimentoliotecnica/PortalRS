using System;
using System.Collections.Generic;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Calcula pesos IDF (Inverse Document Frequency) para tokens em uma coleção de
/// itens DNALIO. Tokens raros (aparecem em poucos itens) ganham peso alto;
/// tokens genéricos (aparecem em quase todos) ficam com peso baixo.
///
/// <para><b>Por que IDF no matching</b>: quando um CV bate "ManageEngine" (termo
/// raro na descrição do cargo — aparece em 1/8 atividades) vale MUITO mais do
/// que bater "através" ou "realizar" (genéricos, aparecem em várias atividades).
/// Sem IDF, o algoritmo trata todos os tokens iguais e o score não discrimina
/// candidato com skill-core vs candidato com só palavras genéricas do perfil.</para>
///
/// <para><b>Fórmula</b>: <c>IDF(t) = log(1 + N / (1 + df(t)))</c> onde N = total
/// de itens da coleção, df(t) = número de itens onde o token aparece.
/// Suavizado (log + 1) para nunca dar 0. Range típico: ~0.3 (genérico) a ~3.0 (raro).</para>
///
/// <para><b>Uso no matching</b>: o peso de cada token no cálculo de cobertura
/// do item passa a ser o IDF em vez de 1. <c>score_item = sum(hit ? idf : 0) / sum(idf)</c>
/// — continua no range [0..1], mas reflete "qualidade" do match.</para>
/// </summary>
public static class TfIdfWeightCalculator
{
    /// <summary>
    /// Constrói o mapa token→IDF a partir de uma lista de textos (itens DNALIO).
    /// Cada texto é tokenizado (stems) uma vez; tokens duplicados dentro do mesmo
    /// item contam como uma ocorrência (document frequency, não term frequency).
    ///
    /// <para>Input: textos já normalizados (sem acento, minúsculo) com sinônimos
    /// expandidos. Use <c>TechSynonyms.Expand(MatchingService.NormalizeText(...))</c>.</para>
    /// </summary>
    /// <param name="normalizedTextos">lista de textos já normalizados + expandidos.</param>
    /// <param name="stopwords">tokens a ignorar (artigos, preposições pt-br).</param>
    /// <param name="minTokenLen">tamanho mínimo do token significativo.</param>
    /// <returns>Mapa stem→idf. Tokens não presentes no mapa têm IDF default = 1.0.</returns>
    public static Dictionary<string, double> BuildIdfMap(
        IReadOnlyList<string> normalizedTextos,
        HashSet<string> stopwords,
        int minTokenLen = 3)
    {
        var df = new Dictionary<string, int>(StringComparer.Ordinal);
        int N = normalizedTextos.Count;
        if (N == 0) return new Dictionary<string, double>(StringComparer.Ordinal);

        foreach (var texto in normalizedTextos)
        {
            if (string.IsNullOrEmpty(texto)) continue;

            // Tokens únicos do item (set) para document frequency
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var raw in texto.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                if (raw.Length < minTokenLen) continue;
                if (stopwords.Contains(raw)) continue;
                var stem = PtBrStemmer.Stem(raw);
                if (string.IsNullOrEmpty(stem)) continue;
                if (seen.Add(stem))
                {
                    df.TryGetValue(stem, out var c);
                    df[stem] = c + 1;
                }
            }
        }

        // IDF = log(1 + N / (1 + df))
        var result = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var kv in df)
        {
            result[kv.Key] = System.Math.Log(1.0 + (double)N / (1.0 + kv.Value));
        }
        return result;
    }

    /// <summary>
    /// Recupera o IDF de um stem; retorna <paramref name="defaultIdf"/> (1.0) se
    /// token não está no mapa — garante que tokens vistos só no CV (não na
    /// descrição de cargo) contribuam com peso neutro.
    /// </summary>
    public static double Get(Dictionary<string, double> idfMap, string stem, double defaultIdf = 1.0)
    {
        if (string.IsNullOrEmpty(stem)) return defaultIdf;
        return idfMap.TryGetValue(stem, out var v) ? v : defaultIdf;
    }
}
