using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Provider que chama a Google Generative Language API (Gemini).
/// Endpoint: POST {ApiBase}/models/{model}:generateContent?key=API_KEY
/// Docs: https://ai.google.dev/api/rest/v1beta/models/generateContent
/// </summary>
public sealed class GeminiProvider : IAiProvider
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<AiOptions> _aiOptions;
    private readonly ILogger<GeminiProvider> _logger;

    public GeminiProvider(
        IHttpClientFactory httpClientFactory,
        IOptions<AiOptions> aiOptions,
        ILogger<GeminiProvider> logger)
    {
        _httpClientFactory = httpClientFactory;
        _aiOptions = aiOptions;
        _logger = logger;
    }

    public async Task<(string Content, decimal Cost)> InvokeAsync(
        string decryptedKey,
        string providerName,
        string modelId,
        object? payload,
        CancellationToken ct)
    {
        var p = providerName?.Trim() ?? "";
        var isGemini = p.Equals("Gemini", StringComparison.OrdinalIgnoreCase)
                    || p.Equals("Google", StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(decryptedKey) || !isGemini)
            return (string.Empty, 0m);

        var (systemPrompt, userContent, imagePart) = ParsePayload(payload);
        if (userContent is null || (userContent is string s && string.IsNullOrWhiteSpace(s) && imagePart is null))
            return (string.Empty, 0m);

        var apiBase = _aiOptions.Value.Gemini?.ApiBase?.TrimEnd('/')
                      ?? "https://generativelanguage.googleapis.com/v1beta";
        var effectiveModel = string.IsNullOrWhiteSpace(modelId)
            ? (_aiOptions.Value.Gemini?.DefaultModel ?? "gemini-2.5-flash")
            : modelId.Trim();

        var client = _httpClientFactory.CreateClient();

        // Monta `contents` de acordo com vision ou texto simples.
        var userParts = new List<object>();
        var textContent = userContent as string ?? "";
        if (!string.IsNullOrEmpty(textContent))
            userParts.Add(new { text = textContent });
        if (imagePart is not null)
            userParts.Add(imagePart);

        object requestBody = new
        {
            system_instruction = string.IsNullOrWhiteSpace(systemPrompt)
                ? null
                : new { parts = new[] { new { text = systemPrompt } } },
            contents = new[]
            {
                new { role = "user", parts = userParts.ToArray() }
            },
            generationConfig = new { temperature = 0.2 }
        };

        var url = $"{apiBase}/models/{Uri.EscapeDataString(effectiveModel)}:generateContent?key={Uri.EscapeDataString(decryptedKey.Trim())}";

        try
        {
            var response = await client.PostAsJsonAsync(url, requestBody, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "Gemini API request failed. StatusCode={StatusCode}, Model={Model}, ResponseBody={ResponseBody}",
                    (int)response.StatusCode,
                    effectiveModel,
                    errBody?.Length > 500 ? errBody[..500] + "..." : errBody);

                string? msg = null;
                try
                {
                    using var errDoc = JsonDocument.Parse(errBody ?? "{}");
                    if (errDoc.RootElement.TryGetProperty("error", out var err) && err.TryGetProperty("message", out var m))
                        msg = m.GetString();
                }
                catch
                {
                    /* ignore */
                }
                return ($"AI_ERROR:{msg ?? $"HTTP {(int)response.StatusCode}"}", 0m);
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
            var content = ExtractTextFromResponse(json);
            var cost = EstimateCost(json, effectiveModel);
            return (content ?? string.Empty, cost);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini API request threw an exception.");
            return ($"AI_ERROR:{ex.Message}", 0m);
        }
    }

    // ────────── helpers ──────────

    private static (string? SystemPrompt, object? UserContent, object? ImagePart) ParsePayload(object? payload)
    {
        if (payload is null) return (null, null, null);
        try
        {
            var json = payload is JsonElement je ? je.GetRawText() : JsonSerializer.Serialize(payload);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var prompt = root.TryGetProperty("prompt", out var pProp) ? pProp.GetString() : null;
            var cvText = root.TryGetProperty("cvText", out var cProp) ? cProp.GetString() : null;

            object? imagePart = null;
            if (root.TryGetProperty("imageBase64", out var imgProp))
            {
                var imageBase64 = imgProp.GetString();
                var rawMediaType = root.TryGetProperty("imageMediaType", out var mtProp) ? mtProp.GetString() : null;
                var mimeType = rawMediaType is "image/png" or "image/jpeg" or "image/gif" or "image/webp" or "application/pdf"
                    ? rawMediaType
                    : "image/jpeg";
                if (!string.IsNullOrEmpty(imageBase64))
                {
                    imagePart = new
                    {
                        inline_data = new
                        {
                            mime_type = mimeType,
                            data = imageBase64
                        }
                    };
                }
            }

            return (prompt, cvText ?? prompt, imagePart);
        }
        catch
        {
            return (null, null, null);
        }
    }

    private static string? ExtractTextFromResponse(JsonElement json)
    {
        // Estrutura: { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
        if (!json.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            return null;

        var first = candidates[0];
        if (!first.TryGetProperty("content", out var content)) return null;
        if (!content.TryGetProperty("parts", out var parts) || parts.GetArrayLength() == 0) return null;

        var builder = new System.Text.StringBuilder();
        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var t))
            {
                var s = t.GetString();
                if (!string.IsNullOrEmpty(s)) builder.Append(s);
            }
        }
        var result = builder.ToString().Trim();
        return string.IsNullOrEmpty(result) ? null : result;
    }

    private static decimal EstimateCost(JsonElement json, string model)
    {
        // Gemini retorna usageMetadata: { promptTokenCount, candidatesTokenCount, totalTokenCount }
        if (!json.TryGetProperty("usageMetadata", out var usage)) return 0m;
        var total = usage.TryGetProperty("totalTokenCount", out var t) ? t.GetInt32() : 0;
        if (total <= 0) return 0m;

        // Estimativa simples: gemini-2.5-flash ≈ $0.30 por 1M tokens (média in/out).
        // gemini-2.5-pro é mais caro, mas sem discriminar in/out aqui aceitamos aproximação.
        var perToken = model.Contains("pro", StringComparison.OrdinalIgnoreCase)
            ? 0.000_003m  // ~ $3/1M
            : 0.000_000_3m; // ~ $0.30/1M
        return (decimal)total * perToken;
    }
}
