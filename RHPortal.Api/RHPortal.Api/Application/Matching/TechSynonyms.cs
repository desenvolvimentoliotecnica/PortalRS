using System.Collections.Generic;
using System.Linq;

namespace RhPortal.Api.Application.Matching;

/// <summary>
/// Dicionário de sinônimos técnicos pt-br/en usados no matching de descrição de
/// cargo × candidato. Expande siglas e variantes comuns na etapa de normalização,
/// ANTES do stemming, para que tokens equivalentes sejam comparáveis.
///
/// <para><b>Estratégia</b>: substitui sigla pela forma canônica expandida
/// (ex.: <c>"AD"</c> → <c>"active directory"</c>). Assim tanto o CV quanto o
/// template DNALIO são normalizados para o mesmo vocabulário. Não é um
/// tesauro completo — começa pequeno com os termos mais comuns em TI/RH
/// e cresce conforme novos domínios aparecem.</para>
///
/// <para>Lookup O(1) via HashSet/Dictionary. Aplicação custa 1 passagem linear
/// por texto — sem regex.</para>
/// </summary>
public static class TechSynonyms
{
    /// <summary>
    /// Mapa "sigla/variante → forma canônica expandida".
    /// Chaves devem estar já normalizadas (minúsculo, sem acento, apenas alfanumérico+espaço).
    /// Valores são as formas canônicas — tanto o CV quanto o template vão ser
    /// reescritos pra elas antes do tokenize+stem.
    /// </summary>
    private static readonly Dictionary<string, string> Map = new(System.StringComparer.Ordinal)
    {
        // ── TI / Infra ──────────────────────────────────────────────────────
        ["ad"] = "active directory",
        ["active directory"] = "active directory", // canônico (mantém)
        ["ms active directory"] = "active directory",
        ["hd"] = "help desk",
        ["help desk"] = "help desk",
        ["helpdesk"] = "help desk",
        ["service desk"] = "help desk",
        ["servicedesk"] = "help desk",
        ["ms office"] = "microsoft office",
        ["microsoft office"] = "microsoft office",
        ["office 365"] = "microsoft office",
        ["o365"] = "microsoft office",
        ["openoffice"] = "open office",
        ["libreoffice"] = "open office", // fuzzy — mesma família conceitual
        ["win"] = "windows",
        ["win10"] = "windows",
        ["win11"] = "windows",
        ["linux ubuntu"] = "linux",
        ["so"] = "sistema operacional",
        ["sistemas operacionais"] = "sistema operacional",
        ["sistema operacional"] = "sistema operacional",
        ["rede"] = "rede",
        ["redes"] = "rede",
        ["lan"] = "rede",
        ["wan"] = "rede",
        ["wifi"] = "rede wireless",
        ["wi fi"] = "rede wireless",
        ["firewall"] = "firewall seguranca",
        ["antivirus"] = "antivirus seguranca",
        ["backup"] = "backup restauracao",
        ["ti"] = "tecnologia informacao",
        ["it"] = "tecnologia informacao",
        ["tecnologia da informacao"] = "tecnologia informacao",
        ["infosec"] = "seguranca informacao",
        ["seguranca da informacao"] = "seguranca informacao",
        ["sec info"] = "seguranca informacao",

        // ── Ferramentas / Vendors ───────────────────────────────────────────
        ["manageengine"] = "manage engine help desk",
        ["manage engine"] = "manage engine help desk",
        ["servicenow"] = "service now help desk",
        ["jira service desk"] = "help desk",
        ["zendesk"] = "help desk",
        ["freshdesk"] = "help desk",

        // ── Dev / Linguagens ────────────────────────────────────────────────
        ["js"] = "javascript",
        ["ts"] = "typescript",
        ["py"] = "python",
        ["cs"] = "csharp",
        ["c sharp"] = "csharp",
        ["c#"] = "csharp",
        ["dotnet"] = "csharp net",
        [".net"] = "csharp net",
        ["node"] = "nodejs",
        ["node js"] = "nodejs",

        // ── Cloud ────────────────────────────────────────────────────────────
        ["aws"] = "amazon web services aws",
        ["gcp"] = "google cloud gcp",
        ["azure"] = "microsoft azure",

        // ── Soft skills / RH ────────────────────────────────────────────────
        ["trabalho em time"] = "trabalho equipe",
        ["trabalho em equipe"] = "trabalho equipe",
        ["team work"] = "trabalho equipe",
        ["teamwork"] = "trabalho equipe",
        ["comunicacao eficaz"] = "comunicacao efetiva",
        ["comunicacao efetiva"] = "comunicacao efetiva",
        ["boa comunicacao"] = "comunicacao efetiva",
        ["proativo"] = "proatividade",
        ["proativa"] = "proatividade",
        ["organizado"] = "organizacao",
        ["organizada"] = "organizacao",
        ["dinamico"] = "dinamismo",
        ["dinamica"] = "dinamismo",
        ["lideranca"] = "lideranca",
        ["lider"] = "lideranca",

        // ── Formação ─────────────────────────────────────────────────────────
        ["superior completo"] = "ensino superior completo",
        ["ensino superior"] = "ensino superior completo",
        ["graduacao"] = "ensino superior completo",
        ["graduado"] = "ensino superior completo",
        ["pos graduacao"] = "pos graduacao",
        ["pos graduado"] = "pos graduacao",
        ["mba"] = "pos graduacao mba",
        ["mestrado"] = "mestrado pos graduacao",
        ["doutorado"] = "doutorado pos graduacao",
    };

    /// <summary>
    /// Expande sinônimos num texto já normalizado. Escaneia tokens (palavras e
    /// bigramas) e substitui por forma canônica. Não-destrutivo: se o texto
    /// original tem "AD" e "Active Directory", após expandir ambos viram
    /// "active directory" e o tokenizer dedupa.
    ///
    /// <para>Estratégia: ordena chaves por tamanho desc (bigramas primeiro) e
    /// substitui por word-boundary para não pegar "ad" dentro de "administrador".</para>
    /// </summary>
    public static string Expand(string normalizedText)
    {
        if (string.IsNullOrEmpty(normalizedText)) return normalizedText;

        // Pad com espaço pra matching robusto em word-boundary
        var padded = " " + normalizedText + " ";

        // Ordena chaves do maior pro menor (bigramas antes de unigramas)
        foreach (var key in OrderedKeys)
        {
            var needle = " " + key + " ";
            if (padded.Contains(needle, System.StringComparison.Ordinal))
            {
                padded = padded.Replace(needle, " " + Map[key] + " ", System.StringComparison.Ordinal);
            }
        }

        return padded.Trim();
    }

    private static readonly string[] OrderedKeys = Map.Keys
        .OrderByDescending(k => k.Length)
        .ToArray();
}
