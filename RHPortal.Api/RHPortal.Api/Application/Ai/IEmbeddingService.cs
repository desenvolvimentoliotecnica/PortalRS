using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Serviço responsável por gerar e PERSISTIR embeddings de entidades do domínio
/// (itens DNALIO da DescricaoCargo, perfis de Candidato). Opera como upsert
/// idempotente: hash do conteúdo-fonte é comparado antes de regerar.
///
/// <para>Esta camada fica entre <see cref="IOllamaClient"/> (raw HTTP) e o
/// <c>HybridMatchingService</c> (que consome os embeddings via
/// <see cref="IVectorSearchService"/>).</para>
/// </summary>
public interface IEmbeddingService
{
    /// <summary>
    /// Indexa um único item DNALIO — gera embedding se ainda não existe ou o texto mudou.
    /// Retorna true se indexou (mudou algo), false se já estava em dia.
    /// </summary>
    Task<bool> IndexDescricaoCargoItemAsync(Guid descricaoCargoItemId, bool force = false, CancellationToken ct = default);

    /// <summary>
    /// Indexa todos os itens de uma <c>DescricaoCargo</c> em batch. Retorna quantos foram re-embedados.
    /// </summary>
    Task<int> IndexDescricaoCargoAsync(Guid descricaoCargoId, bool force = false, CancellationToken ct = default);

    /// <summary>
    /// Indexa o perfil de um candidato (CV + resumo + competências). Idempotente por hash.
    /// </summary>
    Task<bool> IndexCandidatoAsync(Guid candidatoId, bool force = false, CancellationToken ct = default);

    /// <summary>
    /// Re-indexa tudo do tenant atual — usado em bootstrap e quando o modelo de embedding muda.
    /// </summary>
    Task<IndexingStats> IndexTenantAsync(bool force = false, CancellationToken ct = default);
}

public sealed record IndexingStats(int ItensIndexados, int CandidatosIndexados, int Skipped, int Falhas);
