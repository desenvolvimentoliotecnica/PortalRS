using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Time;

namespace RhPortal.Api.Infrastructure.Configuration;

/// <summary>
/// Configuração de SLA de vaga (meta de fechamento em dias).
/// Ordem de resolução: 1) meta da vaga, 2) se urgente → DiasMetaUrgente, 3) por prioridade, 4) DiasMetaFechamento (global).
/// </summary>
public sealed class SlaVagaOptions
{
    public const string SectionName = "SlaVaga";

    /// <summary>Meta global em dias (ex.: 30). Usada quando a vaga não tem meta própria nem nível configurado.</summary>
    public int DiasMetaFechamento { get; set; } = 30;

    /// <summary>Meta em dias quando a vaga está marcada como urgente (ex.: 15). Se null, usa prioridade ou global.</summary>
    public int? DiasMetaUrgente { get; set; }

    /// <summary>Meta por prioridade (dias). Se null para uma prioridade, usa DiasMetaFechamento.</summary>
    public int? DiasMetaPrioridadeBaixa { get; set; }
    public int? DiasMetaPrioridadeMedia { get; set; }
    public int? DiasMetaPrioridadeAlta { get; set; }
    public int? DiasMetaPrioridadeCritica { get; set; }
}

/// <summary>
/// Resolve a meta efetiva de SLA (dias) para uma vaga a partir da config e dos campos da vaga.
/// </summary>
public static class SlaVagaMetaResolver
{
    /// <summary>
    /// Ordem: vaga.SlaDiasMetaFechamento ?? (se Urgente e DiasMetaUrgente configurado) ?? (por Prioridade) ?? global.
    /// </summary>
    public static int GetDiasMeta(
        int? slaDiasVaga,
        bool urgente,
        VagaPrioridade? prioridade,
        SlaVagaOptions options)
    {
        if (options is null)
            return slaDiasVaga ?? 30;

        if (slaDiasVaga.HasValue && slaDiasVaga.Value > 0)
            return slaDiasVaga.Value;

        if (urgente && options.DiasMetaUrgente.HasValue && options.DiasMetaUrgente.Value > 0)
            return options.DiasMetaUrgente.Value;

        if (prioridade.HasValue)
        {
            var dias = prioridade.Value switch
            {
                VagaPrioridade.Critica => options.DiasMetaPrioridadeCritica,
                VagaPrioridade.Alta => options.DiasMetaPrioridadeAlta,
                VagaPrioridade.Media => options.DiasMetaPrioridadeMedia,
                VagaPrioridade.Baixa => options.DiasMetaPrioridadeBaixa,
                _ => null
            };
            if (dias.HasValue && dias.Value > 0)
                return dias.Value;
        }

        return options.DiasMetaFechamento > 0 ? options.DiasMetaFechamento : 30;
    }

    /// <summary>
    /// Meta de SLA em dias úteis a partir do tipo de vaga. Sem exceção por vaga — usa apenas o tipo.
    /// </summary>
    public static int GetDiasMetaUteisFromTipo(int? tipoSlaDiasUteis, SlaVagaOptions options)
    {
        if (tipoSlaDiasUteis.HasValue && tipoSlaDiasUteis.Value > 0)
            return tipoSlaDiasUteis.Value;

        return options.DiasMetaFechamento > 0 ? options.DiasMetaFechamento : 30;
    }

    public static int ContarDiasUteisAbertos(DateTimeOffset? dataAbertura, DateTimeOffset now)
    {
        if (!dataAbertura.HasValue)
            return 0;
        return DiasUteisBrasil.ContarDiasUteisDecorridos(dataAbertura.Value, now);
    }

    public static bool EstaForaDoSlaUteis(DateTimeOffset dataAbertura, DateTimeOffset now, int? tipoSlaDiasUteis, SlaVagaOptions options)
    {
        var meta = GetDiasMetaUteisFromTipo(tipoSlaDiasUteis, options);
        return ContarDiasUteisAbertos(dataAbertura, now) > meta;
    }
}
