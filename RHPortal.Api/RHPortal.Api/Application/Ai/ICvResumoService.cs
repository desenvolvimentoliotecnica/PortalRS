using System;
using System.Threading;
using System.Threading.Tasks;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Gera resumos curtos (2-3 linhas) do CV de um candidato para exibir no card do
/// kanban. Reduz ruído visual e acelera triagem — o recrutador lê 3 linhas em vez
/// de abrir o CV inteiro.
/// </summary>
public interface ICvResumoService
{
    /// <summary>
    /// Gera um resumo do candidato pela identidade. Idempotente: se já existe um resumo
    /// com o mesmo hash do CV atual, retorna o cacheado (persistido em <c>Candidato.ResumoProfissional</c>).
    /// </summary>
    Task<CvResumoResult> ResumirAsync(Guid candidatoId, bool force = false, CancellationToken ct = default);
}

public sealed record CvResumoResult(
    bool IsSuccess,
    string? Resumo,
    bool UsouCache,
    string? ErrorMessage);
