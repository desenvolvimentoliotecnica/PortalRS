using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Embeddings por tenant: Gemini (API Google, rápido, sem GPU) ou Ollama (bge-m3 local).
/// Chave Gemini vem de <c>AiProviderKeys</c> (Owner) ou <c>appsettings.Ai.Gemini</c>.
/// </summary>
public sealed class TenantEmbeddingGenerator : ITenantEmbeddingGenerator
{
    /// <summary>Colunas pgvector do tenant são <c>vector(1024)</c> (legado bge-m3).</summary>
    public const int PgVectorDimensions = 1024;

    private const string DefaultGeminiEmbeddingModel = "gemini-embedding-001";

    private readonly ITenantAiSettingsResolver _tenantSettings;
    private readonly IOllamaClient _ollama;
    private readonly MasterDbContext _masterDb;
    private readonly ISecretProtector _protector;
    private readonly AiOptions _aiOptions;
    private readonly OllamaOptions _ollamaOptions;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TenantEmbeddingGenerator> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public TenantEmbeddingGenerator(
        ITenantAiSettingsResolver tenantSettings,
        IOllamaClient ollama,
        MasterDbContext masterDb,
        ISecretProtector protector,
        IOptions<AiOptions> aiOptions,
        IHttpClientFactory httpClientFactory,
        ILogger<TenantEmbeddingGenerator> logger)
    {
        _tenantSettings = tenantSettings;
        _ollama = ollama;
        _masterDb = masterDb;
        _protector = protector;
        _aiOptions = aiOptions.Value;
        _ollamaOptions = aiOptions.Value.Ollama;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<TenantEmbeddingResult?> GenerateAsync(string text, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var settings = await _tenantSettings.GetCurrentAsync(ct);
        var provider = ResolveEmbeddingProvider(settings);

        if (provider == "ollama")
            return await GenerateOllamaAsync(text, ct);

        if (provider is "gemini" or "google")
            return await GenerateGeminiAsync(settings, text, ct);

        _logger.LogWarning("Embedding provider '{Provider}' não suportado — tentando Gemini.", provider);
        return await GenerateGeminiAsync(settings, text, ct)
               ?? await GenerateOllamaAsync(text, ct);
    }

    private static string ResolveEmbeddingProvider(TenantAiSettings? settings)
    {
        var p = settings?.EmbeddingProvider?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(p)) return p;

        // Tenant só configurou LLM (ex.: gemini) — usar o mesmo para embeddings.
        p = settings?.LlmProvider?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(p)) return p;

        return "gemini";
    }

    private async Task<TenantEmbeddingResult?> GenerateOllamaAsync(string text, CancellationToken ct)
    {
        var vector = await _ollama.EmbedAsync(text, ct);
        if (vector is null || vector.Length == 0) return null;

        var model = _ollamaOptions.EmbeddingModel ?? "bge-m3";
        return new TenantEmbeddingResult(vector, model, "ollama");
    }

    private async Task<TenantEmbeddingResult?> GenerateGeminiAsync(
        TenantAiSettings? settings,
        string text,
        CancellationToken ct)
    {
        var apiKey = await ResolveGeminiApiKeyAsync(settings, ct);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("Gemini embedding: nenhuma API key (Owner → IA ou appsettings.Ai.Gemini).");
            return null;
        }

        var modelId = NormalizeGeminiModelId(settings?.EmbeddingModel);
        var apiBase = _aiOptions.Gemini?.ApiBase?.TrimEnd('/')
                      ?? "https://generativelanguage.googleapis.com/v1beta";

        var url =
            $"{apiBase}/models/{Uri.EscapeDataString(modelId)}:embedContent?key={Uri.EscapeDataString(apiKey.Trim())}";

        var requestBody = new
        {
            content = new { parts = new[] { new { text } } },
            outputDimensionality = PgVectorDimensions,
        };

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(120);

            using var resp = await client.PostAsJsonAsync(url, requestBody, JsonOpts, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "Gemini embedContent HTTP {Status}: {Body}",
                    (int)resp.StatusCode,
                    err.Length > 300 ? err[..300] : err);
                return null;
            }

            var payload = await resp.Content.ReadFromJsonAsync<GeminiEmbedResponse>(JsonOpts, ct);
            var values = payload?.Embedding?.Values;
            if (values is null || values.Count == 0)
            {
                _logger.LogWarning("Gemini embedContent retornou embedding vazio (model={Model}).", modelId);
                return null;
            }

            if (values.Count != PgVectorDimensions)
            {
                _logger.LogWarning(
                    "Gemini embedding dims={Dims}, esperado {Expected} — ajuste outputDimensionality.",
                    values.Count, PgVectorDimensions);
            }

            var vector = values.Select(v => (float)v).ToArray();
            var version = $"{modelId}@{PgVectorDimensions}";
            return new TenantEmbeddingResult(vector, version, "gemini");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao chamar Gemini embedContent (model={Model}).", modelId);
            return null;
        }
    }

    private async Task<string?> ResolveGeminiApiKeyAsync(TenantAiSettings? settings, CancellationToken ct)
    {
        var dbKey = await _masterDb.AiProviderKeys
            .AsNoTracking()
            .Where(x => x.IsActive && x.Provider != null && x.Provider.ToLower() == "gemini")
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (dbKey is not null)
        {
            var decrypted = _protector.Decrypt(dbKey.EncryptedKey);
            if (!string.IsNullOrWhiteSpace(decrypted)) return decrypted;
        }

        var fromConfig = _aiOptions.Gemini?.ApiKey?.Trim();
        return string.IsNullOrEmpty(fromConfig) ? null : fromConfig;
    }

    private static string NormalizeGeminiModelId(string? model)
    {
        var m = string.IsNullOrWhiteSpace(model) ? DefaultGeminiEmbeddingModel : model.Trim();
        if (m.StartsWith("models/", StringComparison.OrdinalIgnoreCase))
            m = m["models/".Length..];
        return m;
    }

    private sealed class GeminiEmbedResponse
    {
        [JsonPropertyName("embedding")]
        public GeminiEmbedValues? Embedding { get; set; }
    }

    private sealed class GeminiEmbedValues
    {
        [JsonPropertyName("values")]
        public List<double>? Values { get; set; }
    }
}
