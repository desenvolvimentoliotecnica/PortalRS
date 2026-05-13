using System.Text.Json;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Application.Common;

/// <summary>
/// Alinha <see cref="Vaga.EscalaTrabalhoRaw"/> (JSON do HorarioEditor no portal) com o cadastro de <see cref="Turno"/>.
/// </summary>
public static class TurnoEscalaTrabalhoRawMapper
{
    private static readonly string[] DiasUteis = ["seg", "ter", "qua", "qui", "sex"];

    /// <summary>
    /// Usado ao criar vaga rascunho a partir da solicitação: prioriza grade/horários do turno; texto livre da solicitação só se for JSON com grade preenchida.
    /// </summary>
    public static string? ResolveForNewVaga(string? solicitacaoEscalaTrabalhoTexto, Turno? turno)
    {
        var fromTurno = ResolveFromTurno(turno);
        if (fromTurno is not null)
            return fromTurno;

        if (!string.IsNullOrWhiteSpace(solicitacaoEscalaTrabalhoTexto)
            && HasPopulatedGrid(solicitacaoEscalaTrabalhoTexto.Trim()))
            return solicitacaoEscalaTrabalhoTexto.Trim();

        return null;
    }

    /// <summary>
    /// Grade JSON do cadastro do turno ou grade sintética 2ª–6ª a partir de StartTime/EndTime (intervalo 12:00–13:00).
    /// </summary>
    public static string? ResolveFromTurno(Turno? turno)
    {
        if (turno is null) return null;

        var grade = NormalizeValidGradeJson(turno.GradeHorarioJson);
        if (grade is not null)
            return grade;

        return BuildComercialGridJson(turno.StartTime, turno.EndTime);
    }

    public static string? NormalizeValidGradeJson(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var t = raw.Trim();
        return HasPopulatedGrid(t) ? t : null;
    }

    /// <summary>
    /// Verifica se o JSON contém objeto <c>grid</c> com pelo menos um horário não vazio (mesmo critério do HorarioEditor).
    /// </summary>
    public static bool HasPopulatedGrid(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("grid", out var grid) || grid.ValueKind != JsonValueKind.Object)
                return false;

            foreach (var row in grid.EnumerateObject())
            {
                if (row.Value.ValueKind != JsonValueKind.Object) continue;
                foreach (var cell in row.Value.EnumerateObject())
                {
                    if (cell.Value.ValueKind == JsonValueKind.String)
                    {
                        var s = cell.Value.GetString();
                        if (!string.IsNullOrWhiteSpace(s))
                            return true;
                    }
                }
            }

            return false;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static string? BuildComercialGridJson(string? startTime, string? endTime)
    {
        if (!TryNormalizeHhMm(startTime, out var ent) || !TryNormalizeHhMm(endTime, out var sai))
            return null;

        const string intIni = "12:00";
        const string intFim = "13:00";

        var entrada = new Dictionary<string, string>(StringComparer.Ordinal);
        var intInicio = new Dictionary<string, string>(StringComparer.Ordinal);
        var intTermino = new Dictionary<string, string>(StringComparer.Ordinal);
        var saida = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var d in new[] { "seg", "ter", "qua", "qui", "sex", "sab", "dom" })
        {
            entrada[d] = "";
            intInicio[d] = "";
            intTermino[d] = "";
            saida[d] = "";
        }

        foreach (var d in DiasUteis)
        {
            entrada[d] = ent;
            intInicio[d] = intIni;
            intTermino[d] = intFim;
            saida[d] = sai;
        }

        var root = new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["escala"] = "",
            ["grid"] = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal)
            {
                ["entrada"] = entrada,
                ["intInicio"] = intInicio,
                ["intTermino"] = intTermino,
                ["saida"] = saida,
            },
        };

        return JsonSerializer.Serialize(root);
    }

    private static bool TryNormalizeHhMm(string? s, out string normalized)
    {
        normalized = "";
        if (string.IsNullOrWhiteSpace(s)) return false;
        var t = s.Trim();
        var parts = t.Split(':');
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return false;
        if (h is < 0 or > 23 || m is < 0 or > 59) return false;
        normalized = $"{h:00}:{m:00}";
        return true;
    }
}

