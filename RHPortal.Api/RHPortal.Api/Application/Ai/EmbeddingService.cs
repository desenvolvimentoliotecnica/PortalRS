using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pgvector;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Indexa embeddings em <c>DescricaoCargoItemEmbeddings</c> e <c>CandidatoEmbeddings</c>
/// via <see cref="ITenantEmbeddingGenerator"/> (Gemini ou Ollama conforme tenant).
/// </summary>
public sealed class EmbeddingService : IEmbeddingService
{
    private readonly AppDbContext _db;
    private readonly ITenantEmbeddingGenerator _embeddingGenerator;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<EmbeddingService> _logger;

    public EmbeddingService(
        AppDbContext db,
        ITenantEmbeddingGenerator embeddingGenerator,
        ITenantContext tenantContext,
        ILogger<EmbeddingService> logger)
    {
        _db = db;
        _embeddingGenerator = embeddingGenerator;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    public async Task<bool> IndexDescricaoCargoItemAsync(Guid descricaoCargoItemId, bool force = false, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var item = await _db.DescricaoCargoItens
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == descricaoCargoItemId, ct);
        if (item is null) return false;

        var source = BuildItemSourceText(item);

        var existing = await _db.DescricaoCargoItemEmbeddings
            .FirstOrDefaultAsync(e => e.DescricaoCargoItemId == descricaoCargoItemId, ct);

        var generated = await _embeddingGenerator.GenerateAsync(source, ct);
        if (generated is null)
        {
            _logger.LogWarning("Embedding vazio para item {ItemId}", descricaoCargoItemId);
            return false;
        }

        if (!force
            && existing is not null
            && existing.Embedding is not null
            && existing.ModelVersion == generated.ModelVersion
            && string.Equals(existing.TextoSource, source, StringComparison.Ordinal))
        {
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        if (existing is null)
        {
            _db.DescricaoCargoItemEmbeddings.Add(new DescricaoCargoItemEmbedding
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DescricaoCargoItemId = descricaoCargoItemId,
                ModelVersion = generated.ModelVersion,
                Dimensions = generated.Vector.Length,
                Embedding = new Vector(generated.Vector),
                TextoSource = Truncate(source, 4000),
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }
        else
        {
            existing.Embedding = new Vector(generated.Vector);
            existing.ModelVersion = generated.ModelVersion;
            existing.Dimensions = generated.Vector.Length;
            existing.TextoSource = Truncate(source, 4000);
            existing.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> IndexDescricaoCargoAsync(Guid descricaoCargoId, bool force = false, CancellationToken ct = default)
    {
        var itens = await _db.DescricaoCargoItens
            .AsNoTracking()
            .Where(i => i.DescricaoCargoId == descricaoCargoId)
            .Select(i => i.Id)
            .ToListAsync(ct);

        int count = 0;
        foreach (var id in itens)
        {
            if (await IndexDescricaoCargoItemAsync(id, force, ct)) count++;
        }
        return count;
    }

    public async Task<bool> IndexCandidatoAsync(Guid candidatoId, bool force = false, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var candidato = await _db.Candidatos
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == candidatoId, ct);
        if (candidato is null) return false;

        var competencias = await _db.CandidatoCompetencias
            .AsNoTracking()
            .Where(x => x.CandidatoId == candidatoId)
            .Select(x => x.Nome)
            .ToListAsync(ct);

        var source = BuildCandidatoSourceText(candidato, competencias);
        if (string.IsNullOrWhiteSpace(source)) return false;
        var hash = ComputeHash(source);

        var existing = await _db.CandidatoEmbeddings
            .FirstOrDefaultAsync(e => e.CandidatoId == candidatoId, ct);

        var generated = await _embeddingGenerator.GenerateAsync(source, ct);
        if (generated is null)
        {
            _logger.LogWarning("Embedding vazio para candidato {CandidatoId}", candidatoId);
            return false;
        }

        if (!force
            && existing is not null
            && existing.Embedding is not null
            && existing.ModelVersion == generated.ModelVersion
            && existing.ConteudoHash == hash)
        {
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        if (existing is null)
        {
            _db.CandidatoEmbeddings.Add(new CandidatoEmbedding
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CandidatoId = candidatoId,
                ModelVersion = generated.ModelVersion,
                Dimensions = generated.Vector.Length,
                Embedding = new Vector(generated.Vector),
                TextoSource = Truncate(source, 8000),
                ConteudoHash = hash,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }
        else
        {
            existing.Embedding = new Vector(generated.Vector);
            existing.ModelVersion = generated.ModelVersion;
            existing.Dimensions = generated.Vector.Length;
            existing.TextoSource = Truncate(source, 8000);
            existing.ConteudoHash = hash;
            existing.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IndexingStats> IndexTenantAsync(bool force = false, CancellationToken ct = default)
    {
        int itens = 0, cands = 0, skipped = 0, falhas = 0;
        try
        {
            var itemIds = await _db.DescricaoCargoItens
                .AsNoTracking().Select(x => x.Id).ToListAsync(ct);
            foreach (var id in itemIds)
            {
                try
                {
                    var changed = await IndexDescricaoCargoItemAsync(id, force, ct);
                    if (changed) itens++; else skipped++;
                }
                catch (Exception ex) { falhas++; _logger.LogWarning(ex, "Falha item {Id}", id); }
            }

            var candIds = await _db.Candidatos
                .AsNoTracking().Select(x => x.Id).ToListAsync(ct);
            foreach (var id in candIds)
            {
                try
                {
                    var changed = await IndexCandidatoAsync(id, force, ct);
                    if (changed) cands++; else skipped++;
                }
                catch (Exception ex) { falhas++; _logger.LogWarning(ex, "Falha candidato {Id}", id); }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha geral ao re-indexar tenant");
            falhas++;
        }

        return new IndexingStats(itens, cands, skipped, falhas);
    }

    internal static string BuildItemSourceText(DescricaoCargoItem item)
    {
        var sb = new StringBuilder();
        sb.Append(item.Categoria.ToString()).Append(": ");
        if (!string.IsNullOrEmpty(item.Subcategoria))
            sb.Append('[').Append(item.Subcategoria).Append("] ");
        sb.Append(item.Texto);
        return sb.ToString().Trim();
    }

    internal static string BuildCandidatoSourceText(Candidato candidato, IReadOnlyList<string> competencias)
    {
        var raw = MatchingService.BuildCandidateProfileText(
            candidato.CvText,
            candidato.ResumoProfissional,
            competencias);
        var norm = MatchingService.NormalizeText(raw);
        return TechSynonyms.Expand(norm);
    }

    internal static string ComputeHash(string text)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(text));
        return Convert.ToHexString(bytes);
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s.Substring(0, max);
}
