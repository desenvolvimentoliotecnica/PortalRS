using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Matching;

public sealed class MatchingService : IMatchingService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public MatchingService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    /// <summary>
    /// Texto do candidato usado no matching: CvText + ResumoProfissional + nomes das competências.
    /// </summary>
    public static string BuildCandidateProfileText(
        string? cvText,
        string? resumoProfissional,
        IReadOnlyList<string> competenciaNomes)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(cvText)) parts.Add(cvText.Trim());
        if (!string.IsNullOrWhiteSpace(resumoProfissional)) parts.Add(resumoProfissional.Trim());
        if (competenciaNomes is { Count: > 0 })
            parts.Add(string.Join(" ", competenciaNomes.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim())));
        return parts.Count == 0 ? string.Empty : string.Join(" ", parts);
    }

    /// <summary>
    /// Normaliza texto para comparação (NFD, minúsculas, sem acentos, apenas alfanuméricos e espaços).
    /// </summary>
    public static string NormalizeText(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var s = input.Trim();
        var normalized = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        var result = sb.ToString().Normalize(NormalizationForm.FormC);
        result = result.ToLowerInvariant();
        var allowed = new StringBuilder();
        foreach (var c in result)
        {
            if (char.IsLetterOrDigit(c) || c == ' ' || c == '+' || c == '#')
                allowed.Append(c);
        }
        return Regex.Replace(allowed.ToString(), @"\s+", " ").Trim();
    }

    private static IReadOnlyList<string> SplitSinonimos(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<string>();
        var items = raw
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return items.Length == 0 ? Array.Empty<string>() : items;
    }

    /// <summary>
    /// Calcula score de compatibilidade salarial (0-100).
    /// </summary>
    public static int CalculateSalaryOverlapScore(decimal? pretensao, decimal? vagaMin, decimal? vagaMax)
    {
        if (!pretensao.HasValue || (!vagaMin.HasValue && !vagaMax.HasValue))
            return 80; // neutro quando dados faltam

        var p = pretensao.Value;
        var min = vagaMin ?? 0m;
        var max = vagaMax ?? min;
        if (max <= 0) return 80;

        if (p <= max && p >= min) return 100;
        if (p < min) return 90; // candidato pede menos — positivo

        var gap = p - max;
        var tolerance10 = max * 0.10m;
        var tolerance20 = max * 0.20m;

        if (gap <= tolerance10) return 70;
        if (gap <= tolerance20) return 40;
        return 10;
    }

    /// <summary>
    /// Calcula score (0-100) e pass (score >= threshold). Mesma fórmula do frontend.
    /// </summary>
    /// <summary>
    /// Calcula score (0-100) e pass (score >= threshold).
    /// Overload com aliases adicionais da taxonomia de skills.
    /// </summary>
    public static (int Score, bool Pass) CalculateScore(
        string profileTextNormalized,
        IReadOnlyList<VagaRequisito> requisitos,
        int matchMinimoPercentual,
        IReadOnlyDictionary<Guid, IReadOnlyList<string>>? skillAliasesBySkillId)
    {
        return CalculateScoreInternal(profileTextNormalized, requisitos, matchMinimoPercentual, skillAliasesBySkillId);
    }

    public static (int Score, bool Pass) CalculateScore(
        string profileTextNormalized,
        IReadOnlyList<VagaRequisito> requisitos,
        int matchMinimoPercentual)
    {
        return CalculateScoreInternal(profileTextNormalized, requisitos, matchMinimoPercentual, null);
    }

    private static (int Score, bool Pass) CalculateScoreInternal(
        string profileTextNormalized,
        IReadOnlyList<VagaRequisito> requisitos,
        int matchMinimoPercentual,
        IReadOnlyDictionary<Guid, IReadOnlyList<string>>? skillAliasesBySkillId)
    {
        if (requisitos is null || requisitos.Count == 0)
            return (0, false);

        var totalPeso = 0;
        var hitPeso = 0;
        var missMandatoryCount = 0;

        foreach (var r in requisitos)
        {
            var p = Math.Clamp((int)r.Peso, 0, 10);
            totalPeso += p;

            var termo = NormalizeText(r.Nome);
            var syns = SplitSinonimos(r.SinonimosRaw).Select(NormalizeText).Where(s => !string.IsNullOrEmpty(s)).ToList();

            // Enrich with taxonomy aliases when SkillId is set
            if (r.SkillId.HasValue && skillAliasesBySkillId != null
                && skillAliasesBySkillId.TryGetValue(r.SkillId.Value, out var taxonomyAliases))
            {
                var extraTerms = taxonomyAliases
                    .Select(NormalizeText)
                    .Where(s => !string.IsNullOrEmpty(s) && !syns.Contains(s) && s != termo);
                syns.AddRange(extraTerms);
            }

            var bag = new List<string>();
            if (!string.IsNullOrEmpty(termo)) bag.Add(termo);
            bag.AddRange(syns);

            var found = bag.Any(t => !string.IsNullOrEmpty(t) && profileTextNormalized.Contains(t, StringComparison.Ordinal));

            if (found)
                hitPeso += p;
            else if (r.Obrigatorio)
                missMandatoryCount++;
        }

        if (totalPeso <= 0) return (0, false);

        var score = (int)Math.Round((hitPeso * 100.0) / totalPeso);
        if (missMandatoryCount > 0)
        {
            score = Math.Max(0, score - Math.Min(40, missMandatoryCount * 15));
            score = Math.Min(score, 60);
        }

        var threshold = Math.Clamp(matchMinimoPercentual, 0, 100);
        var pass = score >= threshold;
        return (score, pass);
    }

    public async Task CalculateAndStoreAsync(Guid candidatoId, Guid vagaId, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var candidato = await _db.Candidatos
            .AsTracking()
            .FirstOrDefaultAsync(c => c.Id == candidatoId && c.TenantId == tenantId, ct);
        if (candidato is null) return;

        string? resumo = null;
        IReadOnlyList<string> competenciaNomes;

        if (candidato.TalentoId.HasValue)
        {
            var talento = await _db.Talentos
                .AsNoTracking()
                .Include(t => t.Pessoa)
                .Include(t => t.Competencias)
                .Include(t => t.Experiencias)
                .FirstOrDefaultAsync(t => t.Id == candidato.TalentoId.Value && t.TenantId == tenantId, ct);
            if (talento is not null)
            {
                resumo = talento.Pessoa?.ResumoProfissional;
                competenciaNomes = talento.Competencias.Select(c => c.Nome).ToList();
                var experienciaTerms = talento.Experiencias
                    .Select(e => $"{e.Empresa} {e.Cargo}".Trim())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();
                competenciaNomes = competenciaNomes.Concat(experienciaTerms).ToList();
            }
            else
                competenciaNomes = Array.Empty<string>();
        }
        else
        {
            resumo = candidato.ResumoProfissional;
            competenciaNomes = await _db.CandidatoCompetencias
                .AsNoTracking()
                .Where(x => x.CandidatoId == candidatoId && x.TenantId == tenantId)
                .Select(x => x.Nome)
                .ToListAsync(ct);
        }

        var profileText = BuildCandidateProfileText(candidato.CvText, resumo, competenciaNomes);

        // Incluir respostas de campos personalizados no texto do perfil
        var respostas = await _db.RespostasCampoPersonalizadoVaga
            .AsNoTracking()
            .Include(r => r.Campo)
            .Where(r => r.CandidatoId == candidatoId && r.VagaId == vagaId && r.TenantId == tenantId)
            .ToListAsync(ct);
        if (respostas.Count > 0)
        {
            var answersText = string.Join(" ", respostas
                .Where(r => r.Campo is not null && !string.IsNullOrWhiteSpace(r.ValorTexto))
                .Select(r => $"{r.Campo!.Label} {r.ValorTexto}"));
            if (!string.IsNullOrWhiteSpace(answersText))
                profileText = string.IsNullOrWhiteSpace(profileText) ? answersText : $"{profileText} {answersText}";
        }

        var profileNormalized = NormalizeText(profileText);

        var vaga = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.Requisitos)
            .FirstOrDefaultAsync(v => v.Id == vagaId && v.TenantId == tenantId, ct);
        if (vaga is null) return;

        var (score, pass) = CalculateScore(profileNormalized, vaga.Requisitos, vaga.MatchMinimoPercentual);
        var at = DateTimeOffset.UtcNow;

        candidato.LastMatchScore = score;
        candidato.LastMatchPass = pass;
        candidato.LastMatchAtUtc = at;
        candidato.LastMatchVagaId = vagaId;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<MatchingCandidateItemResponse>> GetCandidatesWithScoresAsync(
        Guid vagaId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId;
        var vaga = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.Requisitos)
            .FirstOrDefaultAsync(v => v.Id == vagaId && v.TenantId == tenantId, ct);
        if (vaga is null) return Array.Empty<MatchingCandidateItemResponse>();

        var safeTake = Math.Clamp(take, 1, 200);
        var safeMin = Math.Clamp(minScore, 0, 100);

        // Cap: máximo 2000 candidatos para evitar OOM em tenants com base grande.
        // Prioriza candidatos com score existente para esta vaga e mais recentes.
        var candidatos = await _db.Candidatos
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderByDescending(c => c.LastMatchVagaId == vagaId)
            .ThenByDescending(c => c.CreatedAtUtc)
            .Take(2000)
            .ToListAsync(ct);

        var candidatoIds = candidatos.Select(c => c.Id).ToList();
        var competencias = await _db.CandidatoCompetencias
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && candidatoIds.Contains(x.CandidatoId))
            .ToListAsync(ct);
        var competenciasByCandidato = competencias
            .GroupBy(x => x.CandidatoId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.Nome).ToList());

        var talentoIds = candidatos.Where(c => c.TalentoId.HasValue).Select(c => c.TalentoId!.Value).Distinct().ToList();
        Dictionary<Guid, (string? Resumo, IReadOnlyList<string> Nomes)>? talentoProfileByTalentoId = null;
        if (talentoIds.Count > 0)
        {
            var talentos = await _db.Talentos
                .AsNoTracking()
                .Include(t => t.Pessoa)
                .Include(t => t.Competencias)
                .Include(t => t.Experiencias)
                .Where(t => talentoIds.Contains(t.Id) && t.TenantId == tenantId)
                .ToListAsync(ct);
            talentoProfileByTalentoId = talentos.ToDictionary(
                t => t.Id,
                t =>
                {
                    var nomes = t.Competencias.Select(c => c.Nome).ToList();
                    var expTerms = t.Experiencias.Select(e => $"{e.Empresa} {e.Cargo}".Trim()).Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
                    return (t.Pessoa?.ResumoProfissional, (IReadOnlyList<string>)nomes.Concat(expTerms).ToList());
                });
        }

        var results = new List<MatchingCandidateItemResponse>();
        foreach (var c in candidatos)
        {
            string? resumo;
            IReadOnlyList<string> nomes;
            if (c.TalentoId.HasValue && talentoProfileByTalentoId is not null && talentoProfileByTalentoId.TryGetValue(c.TalentoId.Value, out var tp))
            {
                resumo = tp.Resumo;
                nomes = tp.Nomes;
            }
            else
            {
                resumo = c.ResumoProfissional;
                nomes = competenciasByCandidato.TryGetValue(c.Id, out var list) ? list : Array.Empty<string>();
            }
            var profileText = BuildCandidateProfileText(c.CvText, resumo, nomes);
            var profileNormalized = NormalizeText(profileText);
            var (score, pass) = CalculateScore(profileNormalized, vaga.Requisitos, vaga.MatchMinimoPercentual);
            if (score < safeMin) continue;
            results.Add(new MatchingCandidateItemResponse(
                c.Id,
                c.Nome ?? string.Empty,
                c.Email ?? string.Empty,
                score,
                pass,
                null
            ));
        }

        return results
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.Nome)
            .Take(safeTake)
            .ToList();
    }
}
