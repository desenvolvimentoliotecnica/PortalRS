using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Serviço de matching por LLM (Qwen 2.5) — "LLM-as-a-Judge".
///
/// <para>Avaliação profunda candidato × vaga feita pelo Qwen: recebe a DescricaoCargo
/// estruturada (por categoria DNALIO), o CV completo e os pesos calibrados da vaga;
/// retorna JSON com score final, justificativa em PT-BR, breakdown por critério
/// (com pontos fortes e gaps) e se passou no match mínimo.</para>
///
/// <para><b>Diferença do híbrido atual</b>: aqui o LLM <i>raciocina</i> sobre o
/// contexto (detecta experiência correlata, paráfrases, skills equivalentes) em
/// vez de apenas calcular similaridade vetorial. Lento mas profundo — ideal para
/// top-K candidatos ou avaliação on-demand via botão "Ver breakdown".</para>
///
/// <para><b>Cache</b>: resultado é persistido em <c>CandidatoVagaLlmScores</c> com
/// hash SHA256 de (CV + DescCargo + pesos). Próxima chamada com mesmo hash é
/// instantânea. Invalidação automática ao mudar qualquer fonte.</para>
/// </summary>
public interface ILlmMatchingService
{
    /// <summary>
    /// Calcula (ou recupera do cache) o score LLM para um candidato em uma vaga.
    /// Retorna <c>null</c> se Ollama indisponível OU vaga sem DescricaoCargo vinculada.
    /// </summary>
    Task<LlmMatchingResult?> ScoreAsync(Guid candidatoId, Guid vagaId, bool force = false, CancellationToken ct = default);
}

/// <summary>Resultado completo do LLM-as-Judge.</summary>
public sealed record LlmMatchingResult(
    Guid CandidatoId,
    Guid VagaId,
    int ScoreFinal,
    bool PassouMatchMinimo,
    string Justificativa,
    IReadOnlyList<LlmCriterio> Criterios,
    IReadOnlyList<string> PontosFortes,
    IReadOnlyList<string> Gaps,
    string ModelVersion,
    int DurationMs,
    bool UsouCache);

/// <summary>Breakdown por critério gerado pelo LLM.</summary>
public sealed record LlmCriterio(
    string Nome,
    int Peso,
    int Score,
    decimal Contribuicao,
    IReadOnlyList<string> PontosFortes,
    IReadOnlyList<string> Gaps);
