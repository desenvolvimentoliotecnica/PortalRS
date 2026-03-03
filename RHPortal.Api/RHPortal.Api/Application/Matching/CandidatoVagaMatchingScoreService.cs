using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Matching;

public sealed class CandidatoVagaMatchingScoreService : ICandidatoVagaMatchingScoreService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public CandidatoVagaMatchingScoreService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task SaveAiScoreAsync(Guid candidatoId, Guid vagaId, int score, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var at = DateTimeOffset.UtcNow;
        var existing = await _db.CandidatoVagaMatchingScores
            .FirstOrDefaultAsync(x => x.CandidatoId == candidatoId && x.VagaId == vagaId, ct);
        if (existing != null)
        {
            existing.Score = Math.Clamp(score, 0, 100);
            existing.CalculatedAtUtc = at;
        }
        else
        {
            _db.CandidatoVagaMatchingScores.Add(new CandidatoVagaMatchingScore
            {
                CandidatoId = candidatoId,
                VagaId = vagaId,
                Score = Math.Clamp(score, 0, 100),
                CalculatedAtUtc = at,
                TenantId = tenantId,
            });
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<MatchingCandidateItemResponse>> GetRankingByVagaFromStoreAsync(
        Guid vagaId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";
        var safeTake = Math.Clamp(take, 1, 200);
        var safeMin = Math.Clamp(minScore, 0, 100);

        var list = await _db.CandidatoVagaMatchingScores
            .AsNoTracking()
            .Where(x => x.VagaId == vagaId && x.TenantId == tenantId && x.Score >= safeMin)
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.CandidatoId)
            .Take(safeTake)
            .Join(
                _db.Candidatos.AsNoTracking().Where(c => c.TenantId == tenantId),
                s => s.CandidatoId,
                c => c.Id,
                (s, c) => new MatchingCandidateItemResponse(
                    c.Id,
                    c.Nome ?? "",
                    c.Email ?? "",
                    s.Score,
                    s.Score >= safeMin,
                    s.CalculatedAtUtc,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null))
            .ToListAsync(ct);
        return list;
    }

    public async Task ReplaceScoresForVagaAsync(
        Guid vagaId,
        IReadOnlyList<(Guid CandidatoId, int Score)> items,
        string? tenantId = null,
        CancellationToken ct = default)
    {
        var tenantIdVal = tenantId ?? _tenantContext.TenantId ?? "";
        var existing = await _db.CandidatoVagaMatchingScores
            .Where(x => x.VagaId == vagaId && x.TenantId == tenantIdVal)
            .ToListAsync(ct);
        if (existing.Count > 0)
            _db.CandidatoVagaMatchingScores.RemoveRange(existing);
        var at = DateTimeOffset.UtcNow;
        foreach (var (candidatoId, score) in items)
            _db.CandidatoVagaMatchingScores.Add(new CandidatoVagaMatchingScore
            {
                CandidatoId = candidatoId,
                VagaId = vagaId,
                Score = Math.Clamp(score, 0, 100),
                CalculatedAtUtc = at,
                TenantId = tenantIdVal,
            });
        await _db.SaveChangesAsync(ct);
    }
}
