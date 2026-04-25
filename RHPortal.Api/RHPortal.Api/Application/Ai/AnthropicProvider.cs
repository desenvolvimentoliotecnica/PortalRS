using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Provider que chama a Anthropic Messages API (Claude).
/// Endpoint: POST {ApiBase}/messages
/// Docs: https://docs.anthropic.com/en/api/messages
///
/// <para>Headers obrigatórios:</para>
/// <list type="bullet">
///   <item><c>x-api-key</c>: chave da conta</item>
///   <item><c>anthropic-version</c>: "2023-06-01"</item>
///   <item><c>content-type</c>: application/json</item>
/// </list>
/// </summary>
public sealed class AnthropicProvider : IAiProvider
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<AiOptions> _aiOptions;
    private readonly ILogger<AnthropicProvider> _logger;

    public AnthropicProvider(
        IHttpClientFactory httpClientFactory,
        IOptions<AiOptions> aiOptions,
        ILogger<AnthropicProvider> logger)
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
        var isAnthropic = p.Equals("Anthropic", StringComparison.OrdinalIgnoreCase)
                       || p.Equals("Claude", StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(decryptedKey) || !isAnthropic)
            return (string.Empty, 0m);

        var (systemPrompt, userContent, imagePart) = ParsePayload(payload);
        if (userContent is null || (userContent is string s && string.IsNullOrWhiteSpace(s) && imagePart is null))
            return (string.Empty, 0m);

        var opts = _aiOptions.Value.Anthropic ?? new AnthropicOptions();
        var apiBase = string.IsNullOrWhiteSpace(opts.ApiBase)
            ? "https://api.anthropic.com/v1"
            : opts.ApiBase.TrimEnd('/');
        var effectiveModel = string.IsNullOrWhiteSpace(modelId)
            ? opts.DefaultModel
            : modelId.Trim();

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Remove("x-api-key");
        client.DefaultRequestHeaders.Remove("anthropic-version");
        client.DefaultRequestHeaders.Add("x-api-key", decryptedKey.Trim());
        client.DefaultRequestHeaders.Add("anthropic-version", opts.AnthropicVersion);

        // Monta content (texto ou multimodal)
        var contentArray = new List<object>();
        var textContent = userContent as string ?? "";
        if (!string.IsNullOrEmpty(textContent))
            contentArray.Add(new { type = "text", text = textContent });
        if (imagePart is not null)
            contentArray.Add(imagePart);

        object requestBody = new
        {
            model = effectiveModel,
            max_tokens = opts.MaxTokens,
            system = string.IsNullOrWhiteSpace(systemPrompt) ? null : systemPrompt,
            messages = new object[]
            {
                new { role = "user", content = contentArray.ToArray() }
            },
            temperature = 0.2
        };

        try
        {
            var response = await client.PostAsJsonAsync($"{apiBase}/messages", requestBody, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "Anthropic API request failed. StatusCode={StatusCode}, Model={Model}, ResponseBody={ResponseBody}",
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
            _logger.LogWarning(ex, "Anthropic API request threw an exception.");
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
                var mediaType = rawMediaType is "image/png" or "image/jpeg" or "image/gif" or "image/webp"
                    ? rawMediaType
                    : "image/jpeg";
                if (!string.IsNullOrEmpty(imageBase64))
                {
                    imagePart = new
                    {
                        type = "image",
                        source = new
                        {
                            type = "base64",
                            media_type = mediaType,
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
        // Estrutura: { content: [ { type: "text", text: "..." }, ... ] }
        if (!json.TryGetProperty("content", out var content) || content.GetArrayLength() == 0)
            return null;

        var builder = new System.Text.StringBuilder();
        foreach (var block in content.EnumerateArray())
        {
            var type = block.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (type == "text" && block.TryGetProperty("text", out var txt))
            {
                var s = txt.GetString();
                if (!string.IsNullOrEmpty(s)) builder.Append(s);
            }
        }
        var result = builder.ToString().Trim();
        return string.IsNullOrEmpty(result) ? null : result;
    }

    private static decimal EstimateCost(JsonElement json, string model)
    {
        // usage: { input_tokens, output_tokens }
        if (!json.TryGetProperty("usage", out var usage)) return 0m;
        var input = usage.TryGetProperty("input_tokens", out var iTok) ? iTok.GetInt32() : 0;
        var output = usage.TryGetProperty("output_tokens", out var oTok) ? oTok.GetInt32() : 0;
        if (input <= 0 && output <= 0) return 0m;

        // Preços aproximados por 1M tokens (abril/2026):
        //   haiku  : $0.25 in / $1.25 out
        //   sonnet : $3 in / $15 out
        //   opus   : $15 in / $75 out
        decimal perInput, perOutput;
        if (model.Contains("opus", StringComparison.OrdinalIgnoreCase))
        {
            perInput = 0.000_015m;
            perOutput = 0.000_075m;
        }
        else if (model.Contains("haiku", StringComparison.OrdinalIgnoreCase))
        {
            perInput = 0.000_000_25m;
            perOutput = 0.000_001_25m;
        }
        else // sonnet / default
        {
            perInput = 0.000_003m;
            perOutput = 0.000_015m;
        }
        return (decimal)input * perInput + (decimal)output * perOutput;
    }
}
