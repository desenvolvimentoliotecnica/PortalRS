using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace RhPortal.Api.Application.Ai;

/// <summary>Provider que chama a API OpenAI Chat Completions para extração de dados (ex.: currículo).</summary>
public sealed class OpenAiProvider : IAiProvider
{
    private const string ApiBase = "https://api.openai.com/v1";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OpenAiProvider> _logger;

    public OpenAiProvider(IHttpClientFactory httpClientFactory, ILogger<OpenAiProvider> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<(string Content, decimal Cost)> InvokeAsync(string decryptedKey, string providerName, string modelId, object? payload, CancellationToken ct)
    {
        var p = providerName?.Trim() ?? "";
        var isOpenAiOrGpt = p.Equals("OpenAI", StringComparison.OrdinalIgnoreCase) || p.Equals("Gpt", StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(decryptedKey) || !isOpenAiOrGpt)
            return (string.Empty, 0m);

        var (systemPrompt, userContent) = ParsePayload(payload);
        if (string.IsNullOrWhiteSpace(userContent))
            return (string.Empty, 0m);

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", decryptedKey.Trim());

        var requestBody = new
        {
            model = string.IsNullOrWhiteSpace(modelId) ? "gpt-4o-mini" : modelId.Trim(),
            messages = new object[]
            {
                new { role = "system", content = systemPrompt ?? "Você é um assistente que extrai dados estruturados de currículos. Responda apenas com JSON válido." },
                new { role = "user", content = userContent }
            },
            temperature = 0.2
        };

        try
        {
            var response = await client.PostAsJsonAsync($"{ApiBase}/chat/completions", requestBody, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "OpenAI API request failed. StatusCode={StatusCode}, ResponseBody={ResponseBody}",
                    (int)response.StatusCode,
                    errBody?.Length > 500 ? errBody.Substring(0, 500) + "..." : errBody);
                return (string.Empty, 0m);
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
            var content = GetMessageContent(json);
            var cost = EstimateCost(json);
            return (content ?? string.Empty, cost);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI API request threw an exception.");
            return (string.Empty, 0m);
        }
    }

    private static (string? SystemPrompt, string? UserContent) ParsePayload(object? payload)
    {
        if (payload is null) return (null, null);
        try
        {
            var json = payload is JsonElement je ? je.GetRawText() : JsonSerializer.Serialize(payload);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var prompt = root.TryGetProperty("prompt", out var p) ? p.GetString() : null;
            var cvText = root.TryGetProperty("cvText", out var c) ? c.GetString() : null;
            return (prompt, cvText);
        }
        catch
        {
            return (null, null);
        }
    }

    private static string? GetMessageContent(JsonElement json)
    {
        if (json.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
        {
            var first = choices[0];
            if (first.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var content))
                return content.GetString()?.Trim();
        }
        return null;
    }

    private static decimal EstimateCost(JsonElement json)
    {
        if (!json.TryGetProperty("usage", out var usage)) return 0m;
        var total = usage.TryGetProperty("total_tokens", out var t) ? t.GetInt32() : 0;
        return total > 0 ? (decimal)total * 0.000_001m : 0m;
    }
}
