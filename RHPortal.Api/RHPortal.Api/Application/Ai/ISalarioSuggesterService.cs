using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Sugere faixa salarial (min/max) para uma vaga com base em:
///   1. Histórico de salários internos (vagas + categorias salariais do tenant)
///   2. Descrição de cargo vinculada (senioridade, formação, experiência mínima)
///   3. Contexto regional (UF da vaga)
///
/// <para>Usa LLM para raciocinar sobre o contexto agregado e retornar sugestão
/// com justificativa textual. Não é um parecer de mercado — é uma sugestão
/// baseada em dados internos do tenant.</para>
/// </summary>
public interface ISalarioSuggesterService
{
    Task<SalarioSuggestionResult> SuggerirAsync(Guid vagaId, CancellationToken ct = default);
}

public sealed record SalarioSuggestionResult(
    bool IsSuccess,
    decimal? SalarioMinimoSugerido,
    decimal? SalarioMaximoSugerido,
    string? Justificativa,
    /// <summary>Dados internos usados como referência (ex.: "3 vagas similares abertas nos últimos 6m").</summary>
    IReadOnlyList<string>? Referencias,
    string? ErrorMessage);
