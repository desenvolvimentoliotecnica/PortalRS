using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Contracts.Matching;

namespace RhPortal.Api.Infrastructure.Ai;

/// <summary>
/// Cliente HTTP para RHPortal.Ai (POST /match). Em falha retorna null para fallback.
/// BaseAddress configurado no registro do HttpClient (Program.cs).
/// </summary>
public sealed class RHPortalAiMatchClient : IRHPortalAiMatchClient
{
    private readonly HttpClient _http;
    private readonly ILogger<RHPortalAiMatchClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public RHPortalAiMatchClient(HttpClient http, ILogger<RHPortalAiMatchClient> logger)
    {
        _http = http;
        _logger = logger;
    }

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
                        candidatoId,
                        nome,
                        email,
                        similaridade,
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
            using var response = await _http.PostAsync("match-hybrid", content, ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("RHPortal.Ai /match-hybrid retornou {StatusCode}", response.StatusCode);
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
                var candidatoId = item.TryGetProperty("candidato_id", out var cid)
                    ? Guid.Parse(cid.GetString() ?? Guid.Empty.ToString())
                    : Guid.Empty;
                var nome = item.TryGetProperty("nome", out var n) ? n.GetString() ?? "" : "";
                var email = item.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
                var similaridade = item.TryGetProperty("similaridade", out var s) ? s.GetInt32() : 0;

                if (candidatoId == Guid.Empty || similaridade < minScore)
                    continue;

                matching.Add(new MatchingCandidateItemResponse(
                    candidatoId,
                    nome,
                    email,
                    similaridade,
                    similaridade >= minScore,
                    LastMatchAtUtc: DateTimeOffset.UtcNow
                ));
            }
            return matching;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao chamar /match-hybrid para vaga {VagaId}", vagaId);
            return null;
        }
    }
}
