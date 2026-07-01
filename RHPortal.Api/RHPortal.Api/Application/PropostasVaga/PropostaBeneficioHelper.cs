using System.Globalization;
using System.Text.Json;
using RhPortal.Api.Contracts.PropostaVaga;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.PropostasVaga;

internal static class PropostaBeneficioHelper
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    internal static string? Serialize(IReadOnlyList<PropostaBeneficioItemDto>? items)
    {
        if (items is null || items.Count == 0) return null;
        return JsonSerializer.Serialize(items, JsonOpts);
    }

    internal static IReadOnlyList<PropostaBeneficioItemDto> Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<PropostaBeneficioItemDto>();
        try
        {
            var list = JsonSerializer.Deserialize<List<PropostaBeneficioItemDto>>(json, JsonOpts);
            return list ?? [];
        }
        catch
        {
            return [];
        }
    }

    internal static string FormatarListaTexto(IReadOnlyList<PropostaBeneficioItemDto> items)
    {
        if (items.Count == 0) return string.Empty;
        return string.Join("\n", items.Select(FormatarLinha));
    }

    internal static string FormatarListaHtml(IReadOnlyList<PropostaBeneficioItemDto> items)
    {
        if (items.Count == 0) return string.Empty;
        var lis = string.Join("", items.Select(i => $"<li>{System.Net.WebUtility.HtmlEncode(FormatarLinha(i))}</li>"));
        return $"<ul>{lis}</ul>";
    }

    internal static string FormatarLinha(PropostaBeneficioItemDto item)
    {
        var nome = LabelTipo(item.Tipo);
        var partes = new List<string> { nome };
        if (item.Valor.HasValue)
            partes.Add(item.Valor.Value.ToString("C", CultureInfo.GetCultureInfo("pt-BR")));
        var rec = LabelRecorrencia(item.Recorrencia);
        if (!string.IsNullOrWhiteSpace(rec))
            partes.Add(rec);
        if (!string.IsNullOrWhiteSpace(item.Observacoes))
            partes.Add(item.Observacoes.Trim());
        return string.Join(" — ", partes);
    }

    internal static string LabelTipo(VagaBeneficioTipo tipo) => tipo switch
    {
        VagaBeneficioTipo.ValeTransporte => "Vale-transporte",
        VagaBeneficioTipo.ValeRefeicao => "Vale-refeição",
        VagaBeneficioTipo.ValeAlimentacao => "Vale-alimentação",
        VagaBeneficioTipo.PlanoDeSaude => "Plano de saúde",
        VagaBeneficioTipo.PlanoOdontologico => "Plano odontológico",
        VagaBeneficioTipo.SeguroDeVida => "Seguro de vida",
        VagaBeneficioTipo.AuxilioCreche => "Auxílio-creche",
        VagaBeneficioTipo.AuxilioEducacao => "Auxílio-educação",
        VagaBeneficioTipo.GympassBemEstar => "Gympass / bem-estar",
        VagaBeneficioTipo.HomeOfficeAjudaDeCusto => "Ajuda de custo home office",
        VagaBeneficioTipo.DayOffAniversario => "Day off aniversário",
        VagaBeneficioTipo.ParticipacaoResultados => "Participação nos resultados",
        _ => "Outros",
    };

    private static string LabelRecorrencia(VagaBeneficioRecorrencia rec) => rec switch
    {
        VagaBeneficioRecorrencia.Mensal => "mensal",
        VagaBeneficioRecorrencia.Anual => "anual",
        VagaBeneficioRecorrencia.Unico => "único",
        _ => "",
    };
}
