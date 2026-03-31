using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Matching;

public interface INdcgCalculationService
{
    Task<double?> CalculateNdcgForVagaAsync(Guid vagaId, int k = 10, CancellationToken ct = default);
    Task<double?> GetAverageNdcgAsync(int recentVagas = 50, CancellationToken ct = default);
}

public sealed class NdcgCalculationService : INdcgCalculationService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public NdcgCalculationService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Calculates NDCG@K for a vaga based on recruiter feedback.
    /// Relevance grades: Hired=3, Offered/InterviewScheduled=2, Shortlisted=1, Rejected/Viewed=0
    /// </summary>
    public async Task<double?> CalculateNdcgForVagaAsync(Guid vagaId, int k = 10, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";

        // Get the ranked candidates (by matching score desc)
        var rankedCandidates = await _db.CandidatoVagaMatchingScores
            .AsNoTracking()
            .Where(s => s.VagaId == vagaId && s.TenantId == tenantId)
            .OrderByDescending(s => s.Score)
            .ThenBy(s => s.CandidatoId)
            .Take(k)
            .Select(s => s.CandidatoId)
            .ToListAsync(ct);

        if (rankedCandidates.Count == 0)
            return null;

        // Get feedback for these candidates
        var feedbacks = await _db.Set<RecruiterMatchingFeedback>()
            .AsNoTracking()
            .Where(f => f.VagaId == vagaId && f.TenantId == tenantId
                && rankedCandidates.Contains(f.CandidatoId))
            .ToListAsync(ct);

        // Best action per candidate
        var bestAction = feedbacks
            .GroupBy(f => f.CandidatoId)
            .ToDictionary(g => g.Key, g => g.Max(f => f.Action));

        // Build relevance vector for ranked positions
        var relevances = new List<double>();
        foreach (var candidatoId in rankedCandidates)
        {
            var grade = 0.0;
            if (bestAction.TryGetValue(candidatoId, out var action))
            {
                grade = action switch
                {
                    RecruiterMatchingAction.Hired => 3.0,
                    RecruiterMatchingAction.Offered => 2.0,
                    RecruiterMatchingAction.InterviewScheduled => 2.0,
                    RecruiterMatchingAction.Shortlisted => 1.0,
                    _ => 0.0,
                };
            }
            relevances.Add(grade);
        }

        // Also get ALL feedback for the vaga (for IDCG calculation)
        var allFeedbacks = await _db.Set<RecruiterMatchingFeedback>()
            .AsNoTracking()
            .Where(f => f.VagaId == vagaId && f.TenantId == tenantId)
            .ToListAsync(ct);

        var allBestActions = allFeedbacks
            .GroupBy(f => f.CandidatoId)
            .Select(g => g.Max(f => f.Action))
            .Select(a => a switch
            {
                RecruiterMatchingAction.Hired => 3.0,
                RecruiterMatchingAction.Offered => 2.0,
                RecruiterMatchingAction.InterviewScheduled => 2.0,
                RecruiterMatchingAction.Shortlisted => 1.0,
                _ => 0.0,
            })
            .OrderByDescending(x => x)
            .Take(k)
            .ToList();

        var dcg = ComputeDcg(relevances);
        var idcg = ComputeDcg(allBestActions);

        if (idcg <= 0) return null;

        return Math.Round(dcg / idcg, 4);
    }

    public async Task<double?> GetAverageNdcgAsync(int recentVagas = 50, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";

        // Get vagas that have at least some feedback
        var vagaIds = await _db.Set<RecruiterMatchingFeedback>()
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId)
            .Select(f => f.VagaId)
            .Distinct()
            .Take(recentVagas)
            .ToListAsync(ct);

        if (vagaIds.Count == 0) return null;

        var ndcgValues = new List<double>();
        foreach (var vagaId in vagaIds)
        {
            var ndcg = await CalculateNdcgForVagaAsync(vagaId, 10, ct);
            if (ndcg.HasValue)
                ndcgValues.Add(ndcg.Value);
        }

        return ndcgValues.Count > 0 ? Math.Round(ndcgValues.Average(), 4) : null;
    }

    private static double ComputeDcg(List<double> relevances)
    {
        double dcg = 0;
        for (int i = 0; i < relevances.Count; i++)
        {
            dcg += relevances[i] / Math.Log2(i + 2); // i+2 because positions start at 1
        }
        return dcg;
    }
}
