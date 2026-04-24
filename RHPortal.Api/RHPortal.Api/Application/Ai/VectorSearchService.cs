using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Implementa <see cref="IVectorSearchService"/> usando pgvector + EF Core
/// (<c>Pgvector.EntityFrameworkCore</c>).
///
/// <para>Similaridade: <c>1 - cosine_distance</c>. pgvector expõe <c>&lt;=&gt;</c>
/// como operador de distância cosseno (1 - cos_sim), e o pacote .NET expõe
/// <c>CosineDistance(a, b)</c> traduzido para SQL.</para>
///
/// <para><b>Fallback</b>: se o candidato não tem embedding persistido ainda, chama
/// <see cref="IEmbeddingService"/> para gerar on-the-fly; se Ollama down, retorna
/// lista vazia (consumidores caem em léxico).</para>
/// </summary>
public sealed class VectorSearchService : IVectorSearchService
{
    private readonly AppDbContext _db;
    private readonly IEmbeddingService _embeddingService;
    private readonly IOllamaClient _ollama;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<VectorSearchService> _logger;

    public VectorSearchService(
        AppDbContext db,
        IEmbeddingService embeddingService,
        IOllamaClient ollama,
        ITenantContext tenantContext,
        ILogger<VectorSearchService> logger)
    {
        _db = db;
        _embeddingService = embeddingService;
        _ollama = ollama;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SemanticItemMatch>> TopItemsForCandidateInDescricaoAsync(
        Guid candidatoId, Guid descricaoCargoId, int topK = 20, CancellationToken ct = default)
    {
        var candVec = await GetOrGenerateCandidatoVectorAsync(candidatoId, ct);
        if (candVec is null) return Array.Empty<SemanticItemMatch>();

        // JOIN item × embedding + filtro descrição + ORDER BY distância cosseno
        var rows = await _db.DescricaoCargoItemEmbeddings
            .AsNoTracking()
            .Where(e => e.Embedding != null)
            .Join(_db.DescricaoCargoItens.AsNoTracking(),
                  e => e.DescricaoCargoItemId,
                  i => i.Id,
                  (e, i) => new { e, i })
            .Where(x => x.i.DescricaoCargoId == descricaoCargoId)
            .OrderBy(x => x.e.Embedding!.CosineDistance(candVec))
            .Take(topK)
            .Select(x => new
            {
                x.i.Id,
                x.i.DescricaoCargoId,
                x.i.Categoria,
                x.i.Subcategoria,
                x.i.Texto,
                Distance = x.e.Embedding!.CosineDistance(candVec),
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new SemanticItemMatch(
                r.Id, r.DescricaoCargoId, r.Categoria, r.Subcategoria, r.Texto,
                Math.Max(0, 1.0 - r.Distance)))
            .ToList();
    }

    public async Task<Dictionary<DescricaoCargoItemCategoria, double>> SemanticScoreByCategoriaAsync(
        Guid candidatoId, Guid descricaoCargoId, CancellationToken ct = default)
    {
        // Busca TODOS os itens (topK grande) da descrição e agrupa por categoria
        var all = await TopItemsForCandidateInDescricaoAsync(candidatoId, descricaoCargoId, topK: 100, ct);
        var result = new Dictionary<DescricaoCargoItemCategoria, double>();
        foreach (var group in all.GroupBy(x => x.Categoria))
        {
            // Score da categoria = média das similarities dos top itens dessa categoria.
            // Média evita outliers dominarem; cosine sim acima de ~0.45 já indica match significativo.
            result[group.Key] = group.Average(x => x.SimilarityScore);
        }
        return result;
    }

    public async Task<IReadOnlyList<SemanticItemMatch>> SearchItemsByTextAsync(
        string queryText, int topK = 10, Guid? scopedToDescricaoCargoId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(queryText)) return Array.Empty<SemanticItemMatch>();
        var raw = await _ollama.EmbedAsync(queryText, ct);
        if (raw is null) return Array.Empty<SemanticItemMatch>();
        var q = new Vector(raw);

        var query = _db.DescricaoCargoItemEmbeddings
            .AsNoTracking()
            .Where(e => e.Embedding != null)
            .Join(_db.DescricaoCargoItens.AsNoTracking(),
                  e => e.DescricaoCargoItemId,
                  i => i.Id,
                  (e, i) => new { e, i });

        if (scopedToDescricaoCargoId.HasValue)
            query = query.Where(x => x.i.DescricaoCargoId == scopedToDescricaoCargoId.Value);

        var rows = await query
            .OrderBy(x => x.e.Embedding!.CosineDistance(q))
            .Take(topK)
            .Select(x => new
            {
                x.i.Id,
                x.i.DescricaoCargoId,
                x.i.Categoria,
                x.i.Subcategoria,
                x.i.Texto,
                Distance = x.e.Embedding!.CosineDistance(q),
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new SemanticItemMatch(
                r.Id, r.DescricaoCargoId, r.Categoria, r.Subcategoria, r.Texto,
                Math.Max(0, 1.0 - r.Distance)))
            .ToList();
    }

    private async Task<Vector?> GetOrGenerateCandidatoVectorAsync(Guid candidatoId, CancellationToken ct)
    {
        var existing = await _db.CandidatoEmbeddings
            .AsNoTracking()
            .Where(e => e.CandidatoId == candidatoId && e.Embedding != null)
            .Select(e => e.Embedding)
            .FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        // Not indexed yet — generate on the fly & persist
        var changed = await _embeddingService.IndexCandidatoAsync(candidatoId, force: false, ct);
        if (!changed)
        {
            _logger.LogWarning("Não foi possível indexar candidato {Id} on-the-fly", candidatoId);
        }

        return await _db.CandidatoEmbeddings
            .AsNoTracking()
            .Where(e => e.CandidatoId == candidatoId && e.Embedding != null)
            .Select(e => e.Embedding)
            .FirstOrDefaultAsync(ct);
    }
}
