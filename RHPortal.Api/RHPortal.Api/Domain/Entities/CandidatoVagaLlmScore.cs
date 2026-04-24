using System;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Score de matching gerado por LLM (Qwen 2.5) via prompt estruturado.
///
/// <para><b>Como funciona</b>: dado um candidato + vaga, o <c>ILlmMatchingService</c>
/// monta um prompt com a descrição de cargo estruturada (por categoria DNALIO),
/// o CV do candidato e os pesos calibrados da vaga. Qwen avalia e retorna JSON
/// estruturado com score final, justificativa em PT-BR e breakdown por critério.</para>
///
/// <para><b>Cache</b>: resultados são persistidos com hash SHA256 de
/// <c>(CV + DescCargo + Pesos)</c>. Se nada mudou, a mesma avaliação é reusada.
/// Invalidação é automática: mudar qualquer componente muda o hash → próxima
/// chamada recomputa.</para>
///
/// <para><b>Quando invalida</b>: candidato edita CV, DescCargo é reimportada,
/// RH ajusta pesos da vaga. Tudo via interceptor EF (similar ao
/// <c>EmbeddingReindexInterceptor</c>) — futura iteração.</para>
/// </summary>
public sealed class CandidatoVagaLlmScore : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid CandidatoId { get; set; }
    public Candidato? Candidato { get; set; }

    public Guid VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    /// <summary>Score final 0-100 dado pelo LLM.</summary>
    public int ScoreFinal { get; set; }

    /// <summary>True se score ≥ <c>Vaga.MatchMinimoPercentual</c>.</summary>
    public bool PassouMatchMinimo { get; set; }

    /// <summary>Justificativa em PT-BR escrita pelo LLM (2-5 frases).</summary>
    public string JustificativaTexto { get; set; } = string.Empty;

    /// <summary>JSON com array de <c>{ nome, peso, score, contribuicao, pontosFortes[], gaps[] }</c>.</summary>
    public string CriteriosJson { get; set; } = "[]";

    /// <summary>Pontos fortes gerais do candidato (3-5 itens concatenados por ";").</summary>
    public string? PontosFortes { get; set; }

    /// <summary>Gaps gerais (3-5 itens concatenados por ";").</summary>
    public string? Gaps { get; set; }

    /// <summary>
    /// Hash SHA256 de (CV + DescCargo itens + pesos) — invalida cache quando qualquer
    /// um desses muda. Formato hex upper-case.
    /// </summary>
    public string InputHash { get; set; } = string.Empty;

    /// <summary>Modelo usado (ex.: "qwen2.5:7b"). Ao trocar modelo, cache é invalidado.</summary>
    public string ModelVersion { get; set; } = "qwen2.5:7b";

    /// <summary>Tempo de geração em ms (diagnóstico).</summary>
    public int DurationMs { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
