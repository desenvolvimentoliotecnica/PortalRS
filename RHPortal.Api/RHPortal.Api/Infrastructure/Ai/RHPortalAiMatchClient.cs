using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Contracts.Matching;
using RhPortal.Api.Infrastructure.Configuration;

namespace RhPortal.Api.Infrastructure.Ai;

/// <summary>
/// Cliente HTTP para RHPortal.Ai. Suporta matching unificado (v2) e endpoints legados.
/// BaseAddress configurado no registro do HttpClient (Program.cs).
/// </summary>
public sealed class RHPortalAiMatchClient : IRHPortalAiMatchClient
{
    private readonly HttpClient _http;
    private readonly ILogger<RHPortalAiMatchClient> _logger;
    private readonly RhAiOptions _rhAiOptions;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public RHPortalAiMatchClient(
        HttpClient http,
        ILogger<RHPortalAiMatchClient> logger,
        IOptions<RhAiOptions> rhAiOptions)
    {
        _http = http;
        _logger = logger;
        _rhAiOptions = rhAiOptions.Value;
    }

    // ─── Matching Unificado (v2) ─────────────────────────────────────────

    public async Task<IReadOnlyList<MatchingCandidateItemResponse>?> RunUnifiedMatchingAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 20,
        CancellationToken ct = default)
    {
        var payload = new
        {
            vaga_id = vagaId.ToString(),
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim(),
            limit = Math.Clamp(take, 10, 100),
            rule_version = _rhAiOptions.ResolveRuleVersion(tenantId),
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            using var response = await _http.PostAsync("matching/run", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /matching/run retornou {StatusCode}", response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            if (!root.TryGetProperty("matching", out var matchArray))
                return Array.Empty<MatchingCandidateItemResponse>();

            var matching = new List<MatchingCandidateItemResponse>();
            foreach (var item in matchArray.EnumerateArray())
            {
                var personIdStr = item.TryGetProperty("person_id", out var pid) ? pid.GetString() : null;
                if (string.IsNullOrEmpty(personIdStr) || !Guid.TryParse(personIdStr, out var personId))
                    continue;

                var nome = item.TryGetProperty("nome", out var n) ? n.GetString() ?? "" : "";
                var email = item.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
                var scoreFinal = item.TryGetProperty("score_final", out var sf) ? sf.GetInt32() : 0;
                var scoreFiltros = item.TryGetProperty("score_filtros", out var sfl) ? sfl.GetInt32() : 0;
                var scoreRequisitos = item.TryGetProperty("score_requisitos", out var sr) ? sr.GetInt32() : 0;
                int? scoreCompetencia = item.TryGetProperty("score_competencia", out var sco) && sco.ValueKind == JsonValueKind.Number ? sco.GetInt32() : null;
                int? scoreExperiencia = item.TryGetProperty("score_experiencia", out var sex) && sex.ValueKind == JsonValueKind.Number ? sex.GetInt32() : null;
                int? scoreFormacao = item.TryGetProperty("score_formacao", out var sfo) && sfo.ValueKind == JsonValueKind.Number ? sfo.GetInt32() : null;
                int? scoreLocalidade = item.TryGetProperty("score_localidade", out var slo) && slo.ValueKind == JsonValueKind.Number ? slo.GetInt32() : null;
                var source = item.TryGetProperty("source", out var src) ? src.GetString() ?? "candidato" : "candidato";
                var justificativa = item.TryGetProperty("justificativa", out var j) ? j.GetString() ?? "" : "";
                int? mandatoryTotal = null;
                if (item.TryGetProperty("mandatory_total", out var mt) && mt.ValueKind == JsonValueKind.Number)
                    mandatoryTotal = mt.GetInt32();
                int? missingMandatory = null;
                if (item.TryGetProperty("missing_mandatory_count", out var mm) && mm.ValueKind == JsonValueKind.Number)
                    missingMandatory = mm.GetInt32();
                int? mandatoryCoverage = null;
                if (item.TryGetProperty("mandatory_coverage", out var mc) && mc.ValueKind == JsonValueKind.Number)
                    mandatoryCoverage = mc.GetInt32();
                int? hardPenalty = null;
                if (item.TryGetProperty("hard_penalty", out var hp) && hp.ValueKind == JsonValueKind.Number)
                    hardPenalty = hp.GetInt32();
                var ruleVersion = item.TryGetProperty("rule_version", out var rv) && rv.ValueKind == JsonValueKind.String
                    ? rv.GetString()
                    : null;

                if (scoreFinal < minScore)
                    continue;

                matching.Add(new MatchingCandidateItemResponse(
                    CandidatoId: personId,
                    Nome: nome,
                    Email: email,
                    Score: scoreFinal,
                    Pass: scoreFinal >= minScore,
                    LastMatchAtUtc: DateTimeOffset.UtcNow,
                    Source: source,
                    ScoreCompetencia: scoreCompetencia,
                    ScoreExperiencia: scoreExperiencia,
                    ScoreFormacao: scoreFormacao,
                    ScoreLocalidade: scoreLocalidade,
                    ScoreFiltros: scoreFiltros,
                    ScoreRequisitos: scoreRequisitos,
                    Justificativa: justificativa,
                    MandatoryTotal: mandatoryTotal,
                    MissingMandatoryCount: missingMandatory,
                    MandatoryCoverage: mandatoryCoverage,
                    HardPenalty: hardPenalty,
                    RuleVersion: ruleVersion
                ));
            }

            return matching;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao chamar /matching/run para vaga {VagaId}", vagaId);
            return null;
        }
    }

    // ─── Evaluate One (unificado) ─────────────────────────────────────────

    public async Task<(int Score, string? Nome, string? Email)?> EvaluateOneUnifiedAsync(
        Guid vagaId,
        Guid personId,
        string source,
        string tenantId,
        CancellationToken ct = default)
    {
        var payload = new
        {
            vaga_id = vagaId.ToString(),
            person_id = personId.ToString(),
            source = string.IsNullOrWhiteSpace(source) ? "candidato" : source.Trim().ToLowerInvariant(),
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim(),
            rule_version = _rhAiOptions.ResolveRuleVersion(tenantId),
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        try
        {
            using var response = await _http.PostAsync("matching/evaluate-one", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /matching/evaluate-one retornou {StatusCode}", response.StatusCode);
                return null;
            }
            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var score = root.TryGetProperty("score_final", out var sf) ? sf.GetInt32() : 0;
            var nome = root.TryGetProperty("nome", out var n) ? n.GetString() : null;
            var email = root.TryGetProperty("email", out var e) ? e.GetString() : null;
            return (Math.Clamp(score, 0, 100), nome, email);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao chamar RHPortal.Ai /matching/evaluate-one");
            return null;
        }
    }

    // ─── Embedding de Talento ─────────────────────────────────────────────

    public async Task<bool> GenerateTalentoEmbeddingAsync(Guid talentoId, string tenantId, CancellationToken ct = default)
    {
        var payload = new
        {
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim()
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            using var response = await _http.PostAsync($"embeddings/talento/{talentoId}", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /embeddings/talento/{TalentoId} retornou {StatusCode}", talentoId, response.StatusCode);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar embedding do talento {TalentoId}", talentoId);
            return false;
        }
    }

    public async Task<(int Generated, int TotalProcessed)> GenerateTalentosEmbeddingsBatchAsync(
        string tenantId,
        int limit = 50,
        CancellationToken ct = default)
    {
        var payload = new
        {
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim(),
            limit = Math.Clamp(limit, 1, 100),
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        try
        {
            using var response = await _http.PostAsync("embeddings/talentos/batch", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /embeddings/talentos/batch retornou {StatusCode}", response.StatusCode);
                return (0, 0);
            }
            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var generated = root.TryGetProperty("generated", out var g) ? g.GetInt32() : 0;
            var totalProcessed = root.TryGetProperty("total_processed", out var t) ? t.GetInt32() : 0;
            return (generated, totalProcessed);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao chamar RHPortal.Ai /embeddings/talentos/batch");
            return (0, 0);
        }
    }

    // ─── Endpoints Legados ────────────────────────────────────────────────

    public async Task<IReadOnlyList<MatchingCandidateItemResponse>?> GetMatchingByFiltersAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default)
    {
        var payload = new
        {
            vaga_id = vagaId.ToString(),
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim(),
            limit = Math.Clamp(take, 1, 200),
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        try
        {
            using var response = await _http.PostAsync("match", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /match retornou {StatusCode}", response.StatusCode);
                return null;
            }
            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var doc = JsonDocument.Parse(body);
            var matching = new List<MatchingCandidateItemResponse>();
            if (doc.RootElement.TryGetProperty("matching", out var arr))
            {
                foreach (var item in arr.EnumerateArray())
                {
                    var candidatoIdStr = item.TryGetProperty("candidato_id", out var cid) ? cid.GetString() : null;
                    if (string.IsNullOrEmpty(candidatoIdStr) || !Guid.TryParse(candidatoIdStr, out var candidatoId))
                        continue;
                    var nome = item.TryGetProperty("nome", out var n) ? n.GetString() ?? "" : "";
                    var email = item.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
                    var similaridade = item.TryGetProperty("similaridade", out var s) ? s.GetInt32() : 0;
                    if (similaridade < minScore)
                        continue;
                    matching.Add(new MatchingCandidateItemResponse(
                        candidatoId, nome, email, similaridade,
                        Pass: similaridade >= minScore,
                        LastMatchAtUtc: null));
                }
            }
            return matching;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao chamar RHPortal.Ai /match");
            return null;
        }
    }

    public async Task<(int Score, string? Nome, string? Email)?> GetScoreForOneAsync(
        Guid vagaId,
        Guid candidatoId,
        string tenantId,
        CancellationToken ct = default)
    {
        var payload = new
        {
            vaga_id = vagaId.ToString(),
            candidato_id = candidatoId.ToString(),
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim(),
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        try
        {
            using var response = await _http.PostAsync("match-one", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /match-one retornou {StatusCode}", response.StatusCode);
                return null;
            }
            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var doc = JsonDocument.Parse(body);
            var score = doc.RootElement.TryGetProperty("similaridade", out var s) ? s.GetInt32() : 0;
            var nome = doc.RootElement.TryGetProperty("nome", out var n) ? n.GetString() : null;
            var email = doc.RootElement.TryGetProperty("email", out var e) ? e.GetString() : null;
            return (Math.Clamp(score, 0, 100), nome, email);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao chamar RHPortal.Ai /match-one");
            return null;
        }
    }

    public async Task<bool> GenerateVagaEmbeddingAsync(Guid vagaId, string tenantId, CancellationToken ct = default)
    {
        var payload = new
        {
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim()
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            using var response = await _http.PostAsync($"embeddings/vaga/{vagaId}", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /embeddings/vaga/{VagaId} retornou {StatusCode}", vagaId, response.StatusCode);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar embedding da vaga {VagaId}", vagaId);
            return false;
        }
    }

    public async Task<bool> GenerateCandidatoEmbeddingAsync(Guid candidatoId, string tenantId, CancellationToken ct = default)
    {
        var payload = new
        {
            tenant_id = string.IsNullOrWhiteSpace(tenantId) ? null : tenantId.Trim()
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            using var response = await _http.PostAsync($"embeddings/candidato/{candidatoId}", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /embeddings/candidato/{CandidatoId} retornou {StatusCode}", candidatoId, response.StatusCode);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar embedding do candidato {CandidatoId}", candidatoId);
            return false;
        }
    }

    public async Task<IReadOnlyList<MatchingCandidateItemResponse>?> GetMatchingHybridAsync(
        Guid vagaId,
        string tenantId,
        int minScore = 0,
        int take = 50,
        CancellationToken ct = default)
    {
        // Redireciona para o matching unificado
        return await RunUnifiedMatchingAsync(vagaId, tenantId, minScore, take, ct);
    }
}
