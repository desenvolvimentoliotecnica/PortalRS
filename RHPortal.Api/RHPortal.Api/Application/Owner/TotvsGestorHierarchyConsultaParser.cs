using System.Text.Json;
using System.Text.RegularExpressions;

namespace RhPortal.Api.Application.Owner;

public enum TotvsGestorHierarchyConsultaParseKind
{
    /// <summary>Registro com <c>Chefe Superior</c> preenchido.</summary>
    ChefeIdentificado,
    /// <summary>Só colaborador, sem chefe — topo da hierarquia.</summary>
    SemChefeTopo,
    Indeterminado,
}

public readonly record struct TotvsGestorHierarchyConsultaParseResult(
    TotvsGestorHierarchyConsultaParseKind Kind,
    int? ChefeColigada,
    string? ChefeChapa,
    string? ChefeNomeRaw,
    string? RawChefeSuperiorText,
    int? IdHierarquiaRm);

public static class TotvsGestorHierarchyConsultaParser
{
    /// <summary>Tenta extrair coligada e chapa da string longa do Totvs.</summary>
    private static readonly Regex ColigadaChefeRx = new(@"Coligada\s+Chefe:\s*(\d+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex ChapaChefeRx = new(@"Chapa:\s*(\S+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex NomeChefeRx = new(@"Nome:\s*(.+?)\s*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>
    /// Aceita array JSON na raiz ou um objeto com propriedade <c>data</c> (array).
    /// Alinhado à consulta RM (VHIERARQUIAPOSICAO / chefe concatenado como texto em <c>Chefe Superior</c>).
    /// </summary>
    public static TotvsGestorHierarchyConsultaParseResult Parse(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new(TotvsGestorHierarchyConsultaParseKind.Indeterminado, null, null, null, null, null);

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var dataEl) && dataEl.ValueKind == JsonValueKind.Array)
                root = dataEl;

            if (root.ValueKind != JsonValueKind.Array || root.GetArrayLength() == 0)
                return new(TotvsGestorHierarchyConsultaParseKind.Indeterminado, null, null, null, null, null);

            var first = root[0];
            if (first.ValueKind != JsonValueKind.Object)
                return new(TotvsGestorHierarchyConsultaParseKind.Indeterminado, null, null, null, null, null);

            var idHierRm = GetIntPropCaseInsensitive(first, "ID Hierarquia", "IDHIERARQUIA", "Id Hierarquia", "IdHierarquiaRm", "ID Hierarquia RM");

            string? chefeTexto = GetStringPropCaseInsensitive(first, "Chefe Superior", "chefe superior");
            if (!string.IsNullOrWhiteSpace(chefeTexto))
            {
                var col = MatchInt(ColigadaChefeRx, chefeTexto);
                var chapa = NormalizeChapa(MatchStr(ChapaChefeRx, chefeTexto));
                var nomeRaw = MatchNome(NomeChefeRx, chefeTexto);
                return new(TotvsGestorHierarchyConsultaParseKind.ChefeIdentificado, col, chapa, nomeRaw, chefeTexto, idHierRm);
            }

            // Topo: vem Chapa + Funcionário sem chefe
            if (GetStringPropCaseInsensitive(first, "Chapa", "chapa") is { } chapaSelf
                && GetStringPropCaseInsensitive(first, "Funcionário", "funcionário", "Funcionario") != null)
                return new(TotvsGestorHierarchyConsultaParseKind.SemChefeTopo, null, null, null, null, idHierRm);

            return new(TotvsGestorHierarchyConsultaParseKind.Indeterminado, null, null, null, chefeTexto, idHierRm);
        }
        catch (JsonException)
        {
            return new(TotvsGestorHierarchyConsultaParseKind.Indeterminado, null, null, null, null, null);
        }
    }

    private static string? GetStringPropCaseInsensitive(JsonElement obj, params string[] names)
    {
        foreach (var p in obj.EnumerateObject())
        {
            foreach (var n in names)
            {
                if (string.Equals(p.Name, n, StringComparison.OrdinalIgnoreCase))
                {
                    return p.Value.ValueKind switch
                    {
                        JsonValueKind.String => p.Value.GetString(),
                        JsonValueKind.Number => p.Value.GetRawText(),
                        JsonValueKind.Null => null,
                        JsonValueKind.Undefined => null,
                        _ => p.Value.ValueKind switch
                        {
                            JsonValueKind.True => bool.TrueString,
                            JsonValueKind.False => bool.FalseString,
                            _ => p.Value.GetRawText(),
                        },
                    };
                }
            }
        }
        return null;
    }

    private static int? GetIntPropCaseInsensitive(JsonElement obj, params string[] names)
    {
        foreach (var p in obj.EnumerateObject())
        {
            foreach (var n in names)
            {
                if (!string.Equals(p.Name, n, StringComparison.OrdinalIgnoreCase))
                    continue;
                return p.Value.ValueKind switch
                {
                    JsonValueKind.Number when p.Value.TryGetInt32(out var i) => i,
                    JsonValueKind.String => int.TryParse(p.Value.GetString()?.Trim(), out var j) ? j : null,
                    JsonValueKind.Null => null,
                    _ => null,
                };
            }
        }
        return null;
    }

    private static int? MatchInt(Regex rx, string input)
    {
        var m = rx.Match(input);
        return m.Success && int.TryParse(m.Groups[1].Value, out var v) ? v : null;
    }

    private static string? MatchStr(Regex rx, string input)
    {
        var m = rx.Match(input);
        return m.Success ? m.Groups[1].Value.Trim() : null;
    }

    private static string? MatchNome(Regex rx, string input)
    {
        var m = rx.Match(input);
        return m.Success ? m.Groups[1].Value.Trim() : null;
    }

    public static string? NormalizeChapa(string? chapa)
    {
        if (string.IsNullOrWhiteSpace(chapa))
            return null;
        return chapa.Trim();
    }
}
