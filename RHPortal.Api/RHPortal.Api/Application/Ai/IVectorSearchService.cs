using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Busca por similaridade vetorial usando pgvector. Converte textos em embeddings
/// (via <see cref="IOllamaClient"/>) e faz kNN com similaridade cosseno contra
/// os embeddings persistidos de itens DNALIO ou candidatos.
/// </summary>
public interface IVectorSearchService
{
    /// <summary>
    /// Para um candidato dado, retorna os top-K itens DNALIO da descrição de cargo
    /// especificada mais similares ao perfil do candidato.
    /// Útil para scoring semântico por categoria e para explicar "por que bateu".
    /// </summary>
    Task<IReadOnlyList<SemanticItemMatch>> TopItemsForCandidateInDescricaoAsync(
        Guid candidatoId,
        Guid descricaoCargoId,
        int topK = 20,
        CancellationToken ct = default);

    /// <summary>
    /// Similaridade semântica agregada entre um candidato e uma DescricaoCargo,
    /// retornada POR CATEGORIA. Score é a média ponderada da similaridade dos itens
    /// da categoria × pesos da vaga (que vem do matcher — aqui retornamos só raw 0-1).
    /// </summary>
    Task<Dictionary<Domain.Enums.DescricaoCargoItemCategoria, double>> SemanticScoreByCategoriaAsync(
        Guid candidatoId,
        Guid descricaoCargoId,
        CancellationToken ct = default);

    /// <summary>
    /// Busca geral: dado um texto arbitrário, retorna os top-K itens DNALIO mais
    /// similares em TODO o tenant. Usado pelo chatbot RAG para recuperar contexto.
    /// </summary>
    Task<IReadOnlyList<SemanticItemMatch>> SearchItemsByTextAsync(
        string queryText,
        int topK = 10,
        Guid? scopedToDescricaoCargoId = null,
        CancellationToken ct = default);
}

/// <summary>
/// Resultado de busca vetorial: item DNALIO + score de similaridade cosseno [0..1]
/// (1 = idêntico, 0 = ortogonal).
/// </summary>
public sealed record SemanticItemMatch(
    Guid ItemId,
    Guid DescricaoCargoId,
    Domain.Enums.DescricaoCargoItemCategoria Categoria,
    string? Subcategoria,
    string Texto,
    double SimilarityScore);
