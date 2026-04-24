using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Implementação HTTP do <see cref="IOllamaClient"/>. Consome Ollama local (default
/// porta 11434). Robusto a Ollama down: retorna <c>null</c>/<c>IsSuccess=false</c>
/// sem lançar, para que chamadores façam fallback léxico sem try/catch.
///
/// <para><b>Endpoints cobertos</b>:</para>
/// <list type="bullet">
///   <item><c>POST /api/embeddings</c> — embedding single-text (bge-m3, 1024 dims).</item>
///   <item><c>POST /api/chat</c> — chat completion bufferizado.</item>
///   <item><c>POST /api/chat?stream=true</c> — chat streaming (NDJSON).</item>
///   <item><c>GET  /api/tags</c> — lista modelos instalados (health + validação).</item>
/// </list>
/// </summary>
public sealed class OllamaClient : IOllamaClient
{
    private readonly HttpClient _http;
    private readonly OllamaOptions _options;
    private readonly ILogger<OllamaClient> _logger;

    public OllamaClient(HttpClient http, IOptions<AiOptions> aiOptions, ILogger<OllamaClient> logger)
    {
        _http = http;
        _options = aiOptions.Value.Ollama;
        _logger = logger;

        // HttpClient é typed, mas garantimos BaseAddress caso não venha do DI
        if (_http.BaseAddress is null && !string.IsNullOrWhiteSpace(_options.Endpoint))
            _http.BaseAddress = new Uri(_options.Endpoint);
        _http.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
    }

    public async Task<OllamaHealthResult> CheckHealthAsync(CancellationToken ct = default)
    {
        if (!_options.Enabled)
            return new OllamaHealthResult(false, false, false, "Ollama desabilitado via config (Ai:Ollama:Enabled = false).");

        try
        {
            var resp = await _http.GetAsync("/api/tags", ct);
            if (!resp.IsSuccessStatusCode)
                return new OllamaHealthResult(false, false, false, $"HTTP {(int)resp.StatusCode} de /api/tags");

            var payload = await resp.Content.ReadFromJsonAsync<TagsResponse>(JsonOpts, ct);
            var names = payload?.Models?.Select(m => m.Name ?? "").ToList() ?? new();

            bool hasChat = names.Any(n => StartsWithModel(n, _options.ChatModel));
            bool hasEmbed = names.Any(n => StartsWithModel(n, _options.EmbeddingModel));
            return new OllamaHealthResult(true, hasChat, hasEmbed, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ollama /api/tags indisponível em {Endpoint}", _options.Endpoint);
            return new OllamaHealthResult(false, false, false, ex.Message);
        }
    }

    public async Task<float[]?> EmbedAsync(string text, CancellationToken ct = default)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(text)) return null;
        try
        {
            var req = new { model = _options.EmbeddingModel, prompt = text };
            using var resp = await _http.PostAsJsonAsync("/api/embeddings", req, JsonOpts, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Ollama /api/embeddings retornou {StatusCode}", (int)resp.StatusCode);
                return null;
            }
            var payload = await resp.Content.ReadFromJsonAsync<EmbeddingsResponse>(JsonOpts, ct);
            return payload?.Embedding;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao gerar embedding (Ollama indisponível?)");
            return null;
        }
    }

    public async Task<IReadOnlyList<float[]?>> EmbedBatchAsync(IReadOnlyList<string> texts, CancellationToken ct = default)
    {
        // Ollama ainda não tem batch nativo (até 0.20) — serializa com baixa concorrência
        // para não saturar GPU/CPU. Parallel Fetch de 4 em 4 é um bom compromisso.
        var results = new float[]?[texts.Count];
        using var gate = new SemaphoreSlim(4, 4);
        var tasks = new List<Task>(texts.Count);
        for (int i = 0; i < texts.Count; i++)
        {
            int idx = i;
            tasks.Add(Task.Run(async () =>
            {
                await gate.WaitAsync(ct);
                try
                {
                    results[idx] = await EmbedAsync(texts[idx], ct);
                }
                finally { gate.Release(); }
            }, ct));
        }
        await Task.WhenAll(tasks);
        return results;
    }

    public async Task<OllamaChatResponse> ChatAsync(IReadOnlyList<OllamaChatMessage> messages, OllamaChatOptions? options = null, CancellationToken ct = default)
    {
        if (!_options.Enabled)
            return new OllamaChatResponse(false, null, "Ollama desabilitado.");

        try
        {
            var req = BuildChatRequest(messages, options, stream: false);
            using var resp = await _http.PostAsJsonAsync("/api/chat", req, JsonOpts, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                return new OllamaChatResponse(false, null, $"HTTP {(int)resp.StatusCode}: {body}");
            }
            var payload = await resp.Content.ReadFromJsonAsync<ChatResponse>(JsonOpts, ct);
            return new OllamaChatResponse(true, payload?.Message?.Content ?? "", null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha em /api/chat");
            return new OllamaChatResponse(false, null, ex.Message);
        }
    }

    public async Task<OllamaChatWithToolsResponse> ChatWithToolsAsync(
        IReadOnlyList<OllamaMessage> messages,
        IReadOnlyList<OllamaTool> tools,
        OllamaChatOptions? options = null,
        CancellationToken ct = default)
    {
        if (!_options.Enabled)
            return new OllamaChatWithToolsResponse(false, null, null, "Ollama desabilitado.");

        try
        {
            var req = BuildChatWithToolsRequest(messages, tools, options);
            using var resp = await _http.PostAsJsonAsync("/api/chat", req, JsonOpts, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                return new OllamaChatWithToolsResponse(false, null, null, $"HTTP {(int)resp.StatusCode}: {body}");
            }
            var payload = await resp.Content.ReadFromJsonAsync<ChatWithToolsResponseDto>(JsonOpts, ct);
            var msg = payload?.Message;

            List<OllamaToolCall>? toolCalls = null;
            if (msg?.ToolCalls is { Count: > 0 })
            {
                toolCalls = new List<OllamaToolCall>(msg.ToolCalls.Count);
                foreach (var tc in msg.ToolCalls)
                {
                    if (tc?.Function is null) continue;
                    // Ollama pode enviar arguments como objeto inline ou como string JSON — normalizamos.
                    var argsElement = tc.Function.Arguments.ValueKind switch
                    {
                        JsonValueKind.String => SafeParseJsonString(tc.Function.Arguments.GetString()),
                        _ => tc.Function.Arguments
                    };
                    toolCalls.Add(new OllamaToolCall(
                        tc.Function.Name ?? "",
                        argsElement,
                        tc.Id));
                }
            }

            return new OllamaChatWithToolsResponse(true, msg?.Content, toolCalls, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha em /api/chat (tools)");
            return new OllamaChatWithToolsResponse(false, null, null, ex.Message);
        }
    }

    private object BuildChatWithToolsRequest(
        IReadOnlyList<OllamaMessage> messages,
        IReadOnlyList<OllamaTool> tools,
        OllamaChatOptions? opts)
    {
        var msgList = new List<object>();
        if (!string.IsNullOrEmpty(opts?.SystemPrompt))
            msgList.Add(new { role = "system", content = opts.SystemPrompt });

        foreach (var m in messages)
        {
            if (m.ToolCalls is { Count: > 0 })
            {
                // Mensagem do assistant com tool calls
                msgList.Add(new
                {
                    role = m.Role,
                    content = m.Content ?? "",
                    tool_calls = m.ToolCalls.Select(tc => new
                    {
                        function = new
                        {
                            name = tc.Name,
                            arguments = tc.Arguments,
                        }
                    }).ToArray()
                });
            }
            else if (!string.IsNullOrEmpty(m.ToolCallId) || m.Role == "tool")
            {
                // Resultado de uma tool executada
                msgList.Add(new { role = "tool", content = m.Content ?? "" });
            }
            else
            {
                msgList.Add(new { role = m.Role, content = m.Content ?? "" });
            }
        }

        var toolsList = tools.Select(t => new
        {
            type = "function",
            function = new
            {
                name = t.Name,
                description = t.Description,
                parameters = t.ParametersSchema,
            }
        }).ToArray();

        return new
        {
            model = opts?.Model ?? _options.ChatModel,
            messages = msgList,
            tools = toolsList,
            stream = false,
            keep_alive = _options.KeepAlive,
            options = new
            {
                temperature = opts?.Temperature ?? 0.2,
                num_predict = opts?.MaxTokens ?? 2048,
            }
        };
    }

    private static JsonElement SafeParseJsonString(string? s)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(s)) return JsonDocument.Parse("{}").RootElement;
            return JsonDocument.Parse(s).RootElement;
        }
        catch
        {
            return JsonDocument.Parse("{}").RootElement;
        }
    }

    public async IAsyncEnumerable<string> ChatStreamAsync(
        IReadOnlyList<OllamaChatMessage> messages,
        OllamaChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!_options.Enabled) yield break;

        var req = BuildChatRequest(messages, options, stream: true);
        using var reqMessage = new HttpRequestMessage(HttpMethod.Post, "/api/chat")
        {
            Content = JsonContent.Create(req, options: JsonOpts),
        };

        using var resp = await _http.SendAsync(reqMessage, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Ollama /api/chat stream retornou {StatusCode}", (int)resp.StatusCode);
            yield break;
        }

        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream, Encoding.UTF8);

        while (!reader.EndOfStream)
        {
            if (ct.IsCancellationRequested) yield break;
            var line = await reader.ReadLineAsync(ct);
            if (string.IsNullOrWhiteSpace(line)) continue;

            ChatResponse? chunk = null;
            try { chunk = JsonSerializer.Deserialize<ChatResponse>(line, JsonOpts); }
            catch { continue; }

            var piece = chunk?.Message?.Content;
            if (!string.IsNullOrEmpty(piece)) yield return piece;

            if (chunk?.Done == true) yield break;
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────
    private object BuildChatRequest(IReadOnlyList<OllamaChatMessage> messages, OllamaChatOptions? opts, bool stream)
    {
        var msgList = new List<object>();
        if (!string.IsNullOrEmpty(opts?.SystemPrompt))
            msgList.Add(new { role = "system", content = opts.SystemPrompt });
        foreach (var m in messages)
            msgList.Add(new { role = m.Role, content = m.Content });

        return new
        {
            model = opts?.Model ?? _options.ChatModel,
            messages = msgList,
            stream,
            // keep_alive: mantém o modelo carregado na memória do Ollama.
            // Evita cold-start (carregar 4.7GB do disco) em chamadas subsequentes.
            keep_alive = _options.KeepAlive,
            options = new
            {
                temperature = opts?.Temperature ?? 0.3,
                num_predict = opts?.MaxTokens ?? 2048,
            }
        };
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private static bool StartsWithModel(string fullName, string shortName)
    {
        if (string.IsNullOrEmpty(fullName) || string.IsNullOrEmpty(shortName)) return false;
        // Ollama tags vêm como "qwen2.5:7b" ou "qwen2.5:7b-instruct" — comparamos prefix.
        return fullName.StartsWith(shortName, StringComparison.OrdinalIgnoreCase);
    }

    // ── DTOs ───────────────────────────────────────────────────────────────
    private sealed class TagsResponse
    {
        [JsonPropertyName("models")]
        public List<ModelInfo>? Models { get; set; }
    }
    private sealed class ModelInfo
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
    private sealed class EmbeddingsResponse
    {
        [JsonPropertyName("embedding")]
        public float[]? Embedding { get; set; }
    }
    private sealed class ChatResponse
    {
        [JsonPropertyName("message")]
        public ChatMessageDto? Message { get; set; }
        [JsonPropertyName("done")]
        public bool Done { get; set; }
    }
    private sealed class ChatMessageDto
    {
        [JsonPropertyName("role")]
        public string? Role { get; set; }
        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }

    // ── DTOs para Function Calling ─────────────────────────────────────────
    private sealed class ChatWithToolsResponseDto
    {
        [JsonPropertyName("message")]
        public ToolMessageDto? Message { get; set; }
        [JsonPropertyName("done")]
        public bool Done { get; set; }
    }
    private sealed class ToolMessageDto
    {
        [JsonPropertyName("role")]
        public string? Role { get; set; }
        [JsonPropertyName("content")]
        public string? Content { get; set; }
        [JsonPropertyName("tool_calls")]
        public List<ToolCallDto>? ToolCalls { get; set; }
    }
    private sealed class ToolCallDto
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }
        [JsonPropertyName("function")]
        public ToolCallFunctionDto? Function { get; set; }
    }
    private sealed class ToolCallFunctionDto
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }
        [JsonPropertyName("arguments")]
        public JsonElement Arguments { get; set; }
    }
}
