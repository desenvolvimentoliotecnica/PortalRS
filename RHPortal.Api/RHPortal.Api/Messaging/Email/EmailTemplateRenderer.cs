using System.Text.Json;
using System.Text.RegularExpressions;

namespace RhPortal.Api.Messaging.Email;

public static class EmailTemplateRenderer
{
    private static readonly Dictionary<string, string> AliasToCanonical = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Nome"] = "CandidatoNome",
        ["nome"] = "CandidatoNome",
        ["candidato.nome"] = "CandidatoNome",
        ["candidatoNome"] = "CandidatoNome",
        ["VagaTitulo"] = "VagaTitulo",
        ["vaga.titulo"] = "VagaTitulo",
        ["vagaTitulo"] = "VagaTitulo",
        ["empresa"] = "EmpresaNome",
        ["empresa.nome"] = "EmpresaNome",
        ["empresaNome"] = "EmpresaNome",
        ["url"] = "UrlPreAdmissao",
        ["Url"] = "UrlPreAdmissao",
        ["entrevista.data"] = "EntrevistaData",
        ["entrevistaData"] = "EntrevistaData",
        ["entrevista.horario"] = "EntrevistaHorario",
        ["entrevistaHorario"] = "EntrevistaHorario",
        ["entrevista.modalidade"] = "EntrevistaModalidade",
        ["entrevistaModalidade"] = "EntrevistaModalidade",
        ["entrevista.link_confirmacao"] = "EntrevistaLinkConfirmacao",
        ["entrevistaLink"] = "EntrevistaLinkConfirmacao",
        ["linkAvaliacao"] = "LinkAvaliacao",
        ["Link"] = "LinkAvaliacao",
        ["dataAdmissao"] = "DataAdmissao",
        ["documentos"] = "DocumentosPendentes",
        ["observacao"] = "Observacao",
    };

    public static IReadOnlyDictionary<string, string?> ExpandAliases(IReadOnlyDictionary<string, string?> values)
    {
        var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in values)
            map[kvp.Key] = kvp.Value;

        // Mirror aliases INTO canonical and reverse so {{nome}} and {{CandidatoNome}} both work.
        foreach (var kvp in values.ToList())
        {
            if (AliasToCanonical.TryGetValue(kvp.Key, out var canonical))
                map[canonical] = kvp.Value ?? map.GetValueOrDefault(canonical);

            foreach (var alias in AliasToCanonical.Where(a =>
                         string.Equals(a.Value, kvp.Key, StringComparison.OrdinalIgnoreCase)
                         || string.Equals(a.Key, kvp.Key, StringComparison.OrdinalIgnoreCase)))
            {
                map.TryAdd(alias.Key, kvp.Value);
                map.TryAdd(alias.Value, kvp.Value);
            }
        }

        // Also expose curly-brace single style used by kanban: {candidatoNome}
        foreach (var kvp in map.ToList())
        {
            if (AliasToCanonical.TryGetValue(kvp.Key, out var canonical))
                map.TryAdd(canonical, kvp.Value);
        }

        return map;
    }

    public static string Render(string template, IReadOnlyDictionary<string, string?> values)
    {
        var expanded = ExpandAliases(values);
        var result = template ?? string.Empty;

        foreach (var kvp in expanded)
        {
            var token = $"{{{{{kvp.Key}}}}}";
            result = result.Replace(token, kvp.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        // Legacy single-brace placeholders from kanban notification templates
        foreach (var kvp in expanded)
        {
            var single = $"{{{kvp.Key}}}";
            result = result.Replace(single, kvp.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        // Strip any leftover unknown {{Tags}} optionally leave them — leave as-is for debugging
        return result;
    }

    public static string ToJson(IReadOnlyDictionary<string, string?> values)
        => JsonSerializer.Serialize(values);

    public static string StripHtmlToText(string html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        var text = Regex.Replace(html, "<br\\s*/?>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "</p>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<[^>]+>", string.Empty);
        return System.Net.WebUtility.HtmlDecode(text).Trim();
    }
}
