using System.Globalization;
using System.Text.RegularExpressions;
using RhPortal.Api.Contracts.Vagas;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.IntegracaoTotvs;

/// <summary>
/// Aplica campos vindos do worker TOTVS RM (<see cref="VagaSyncRmItem"/>) na entidade <see cref="Vaga"/>.
/// </summary>
public static class VagaRmSyncApplicator
{
    private static readonly Regex AnosExperienciaRegex = new(
        @"(?<n>\d+)\s*(?:ano|anos)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
        TimeSpan.FromMilliseconds(250));

    private static readonly Regex ValorMonetarioRegex = new(
        @"(?<!\d)(?:\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)(?!\d)",
        RegexOptions.CultureInvariant,
        TimeSpan.FromMilliseconds(100));

    /// <summary>Importacao RM: tipo de contratacao padrao CLT.</summary>
    public static void ApplyImportFields(Vaga v, VagaSyncRmItem item)
    {
        v.TipoContratacao = VagaTipoContratacao.CLT;
        v.Moeda ??= VagaMoeda.BRL;

        var dataInicioFonte = item.DataPrevistaInicio ?? item.DataAbertura;
        if (dataInicioFonte.HasValue)
            v.DataInicio = DateOnly.FromDateTime(dataInicioFonte.Value.Date);

        v.DataEncerramento = item.DataFechamento.HasValue
            ? DateOnly.FromDateTime(item.DataFechamento.Value.Date)
            : null;

        var salarioNumerico = item.VlrSalario is > 0 ? item.VlrSalario : null;
        if (!salarioNumerico.HasValue)
            salarioNumerico = TryParseDecimalPtBr(item.Remuneracao);

        if (salarioNumerico is > 0)
        {
            v.SalarioMinimo = salarioNumerico;
            v.SalarioMaximo = salarioNumerico;
        }

        var obsRem = BuildObservacoesRemuneracao(item, salarioNumerico);
        if (!string.IsNullOrWhiteSpace(obsRem))
            v.ObservacoesRemuneracao = Truncate(obsRem, 240);

        if (!string.IsNullOrWhiteSpace(item.FuncaoCbo))
            v.CodigoCbo = Truncate(item.FuncaoCbo.Trim(), 20);

        if (!string.IsNullOrWhiteSpace(item.FuncaoDescricao))
            v.DescricaoPublica = item.FuncaoDescricao.Trim();

        if (!string.IsNullOrWhiteSpace(item.Justificativa))
        {
            var just = item.Justificativa.Trim();
            v.ObservacoesProcesso = just;
            v.ResumoPitch = Truncate(just, 120);
        }

        if (!string.IsNullOrWhiteSpace(item.GestorRequisitanteNome))
            v.GestorRequisitante = Truncate(item.GestorRequisitanteNome.Trim(), 120);

        var esc = MapCodGrauInstrucaoRm(item.CodGrauInstrucao);
        if (esc.HasValue)
            v.Escolaridade = esc.Value;

        var anos = TryExtractAnosExperiencia(item.ExperienciasExigidas, item.ExperienciasDesejadas);
        if (anos.HasValue)
            v.ExperienciaMinimaAnos = anos;

        var dif = BuildDiferenciais(item);
        if (!string.IsNullOrWhiteSpace(dif))
            v.Diferenciais = dif.Trim();
    }

    public static bool ApplyCltDefaultForImportedRmVaga(Vaga v)
    {
        if (v.TipoContratacao.HasValue)
            return false;

        if (string.IsNullOrWhiteSpace(v.IdReqRmOrigem) && string.IsNullOrWhiteSpace(v.Codigo))
            return false;

        v.TipoContratacao = VagaTipoContratacao.CLT;
        return true;
    }

    public static string? BuildObservacoesRemuneracao(VagaSyncRmItem item, decimal? salarioParseado)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(item.CodTabelaSalarial)
            || !string.IsNullOrWhiteSpace(item.CodNivelSalarial)
            || !string.IsNullOrWhiteSpace(item.CodFaixaSalarial))
        {
            parts.Add(
                $"Faixa RM: tabela={item.CodTabelaSalarial ?? "-"}; nivel={item.CodNivelSalarial ?? "-"}; faixa={item.CodFaixaSalarial ?? "-"}");
        }

        if (!salarioParseado.HasValue && !string.IsNullOrWhiteSpace(item.Remuneracao))
            parts.Add($"Remuneracao (texto RM): {item.Remuneracao.Trim()}");

        return parts.Count == 0 ? null : string.Join("\n", parts);
    }

    public static decimal? TryParseDecimalPtBr(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var t = text.Trim();
        var matches = ValorMonetarioRegex.Matches(t);
        if (matches.Count != 1)
            return null;

        var cleaned = matches[0].Value;

        if (cleaned.Contains(','))
        {
            var lastComma = cleaned.LastIndexOf(',');
            var intPart = cleaned[..lastComma].Replace(".", "");
            var fracPart = cleaned[(lastComma + 1)..].Replace(".", "");
            if (decimal.TryParse($"{intPart}.{fracPart}", NumberStyles.Number, CultureInfo.InvariantCulture, out var d))
                return d;
        }

        if (decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.GetCultureInfo("pt-BR"), out var d2))
            return d2;

        if (decimal.TryParse(cleaned, NumberStyles.Number, CultureInfo.InvariantCulture, out var d3))
            return d3;

        return null;
    }

    /// <summary>
    /// Mapeia CODGRAUINSTRUCAO do RM (TOTVS) para <see cref="VagaEscolaridade"/>.
    /// Valores desconhecidos retornam null (nao altera a vaga).
    /// </summary>
    public static VagaEscolaridade? MapCodGrauInstrucaoRm(int? cod)
    {
        if (!cod.HasValue || cod.Value <= 0) return null;
        return cod.Value switch
        {
            1 => VagaEscolaridade.Fundamental,
            2 => VagaEscolaridade.Medio,
            3 => VagaEscolaridade.Tecnico,
            4 => VagaEscolaridade.SuperiorCursando,
            5 => VagaEscolaridade.SuperiorCompleto,
            6 => VagaEscolaridade.PosGraduacao,
            7 => VagaEscolaridade.Mestrado,
            8 => VagaEscolaridade.Doutorado,
            9 => VagaEscolaridade.SuperiorCompleto,
            10 => VagaEscolaridade.PosGraduacao,
            11 => VagaEscolaridade.SuperiorCompleto,
            12 => VagaEscolaridade.PosGraduacao,
            _ => null,
        };
    }

    internal static int? TryExtractAnosExperiencia(string? exigidas, string? desejadas)
    {
        foreach (var txt in new[] { exigidas, desejadas })
        {
            if (string.IsNullOrWhiteSpace(txt)) continue;
            var m = AnosExperienciaRegex.Match(txt);
            if (m.Success && int.TryParse(m.Groups["n"].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                return n;
        }
        return null;
    }

    internal static string? BuildDiferenciais(VagaSyncRmItem item)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(item.ComplementoGrauInstrucao))
            parts.Add($"Instrucao (complemento RM): {item.ComplementoGrauInstrucao.Trim()}");
        if (!string.IsNullOrWhiteSpace(item.ExperienciasExigidas))
            parts.Add($"Experiencia exigida (RM): {item.ExperienciasExigidas.Trim()}");
        if (!string.IsNullOrWhiteSpace(item.ExperienciasDesejadas))
            parts.Add($"Experiencia desejada (RM): {item.ExperienciasDesejadas.Trim()}");
        return parts.Count == 0 ? null : string.Join("\n\n", parts);
    }

    private static string? Truncate(string? value, int maxLen)
    {
        if (string.IsNullOrEmpty(value)) return value;
        var t = value.Trim();
        return t.Length <= maxLen ? t : t[..maxLen];
    }
}
