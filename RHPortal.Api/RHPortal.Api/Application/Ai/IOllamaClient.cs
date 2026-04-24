using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Cliente HTTP tipado para a API do Ollama local. Expõe só os endpoints que
/// consumimos: <c>/api/embeddings</c>, <c>/api/chat</c> (stream e buffered) e
/// <c>/api/tags</c> (health). Resto é detalhe de implementação no <see cref="OllamaClient"/>.
///
/// <para><b>Design</b>: toda operação é async, cancelável, e retorna tipos fortes
/// com <c>IsSuccess</c>/<c>Error</c> para que consumidores possam fallback em léxico
/// sem try/catch. Nunca lança por erro de rede/modelo; só lança em bug de código
/// (argumento inválido).</para>
/// </summary>
public interface IOllamaClient
{
    /// <summary>
    /// Retorna true se Ollama está up e o modelo default de chat + embeddings
    /// estão carregados (listados em <c>/api/tags</c>).
    /// </summary>
    Task<OllamaHealthResult> CheckHealthAsync(CancellationToken ct = default);

    /// <summary>
    /// Gera um embedding (vetor) para um texto. Usa <see cref="OllamaOptions.EmbeddingModel"/>.
    /// Retorna <c>null</c> se Ollama não disponível; caller deve cair em léxico.
    /// </summary>
    Task<float[]?> EmbedAsync(string text, CancellationToken ct = default);

    /// <summary>
    /// Gera embeddings em batch (mais eficiente que 1-por-1). Se o modelo não suporta
    /// batch nativo, o cliente faz N requests sequenciais internamente.
    /// </summary>
    Task<IReadOnlyList<float[]?>> EmbedBatchAsync(IReadOnlyList<string> texts, CancellationToken ct = default);

    /// <summary>
    /// Gera uma resposta completa (não-streaming) para uma conversação. Use quando
    /// precisar do texto final como string (ex.: gerar DescCargo, resumir CV).
    /// </summary>
    Task<OllamaChatResponse> ChatAsync(IReadOnlyList<OllamaChatMessage> messages, OllamaChatOptions? options = null, CancellationToken ct = default);

    /// <summary>
    /// Chat com <b>Function Calling</b> (OpenAI-compatível). O LLM recebe o catálogo
    /// de tools e pode invocar uma ou mais retornando <c>tool_calls</c> no response.
    /// O chamador executa as tools, adiciona o resultado na conversa como <c>role:"tool"</c>
    /// e re-invoca este método — loop ReAct até o LLM dar resposta final sem tool_calls.
    /// </summary>
    Task<OllamaChatWithToolsResponse> ChatWithToolsAsync(
        IReadOnlyList<OllamaMessage> messages,
        IReadOnlyList<OllamaTool> tools,
        OllamaChatOptions? options = null,
        CancellationToken ct = default);

    /// <summary>
    /// Streaming de resposta — emite chunks conforme o modelo gera. Usado no chat
    /// UI pra resposta aparecer incrementalmente.
    /// </summary>
    IAsyncEnumerable<string> ChatStreamAsync(IReadOnlyList<OllamaChatMessage> messages, OllamaChatOptions? options = null, CancellationToken ct = default);
}

public sealed record OllamaHealthResult(bool IsReachable, bool HasChatModel, bool HasEmbeddingModel, string? ErrorMessage);

public sealed record OllamaChatMessage(string Role, string Content);

public sealed record OllamaChatOptions(
    string? Model = null,
    double? Temperature = null,
    int? MaxTokens = null,
    string? SystemPrompt = null);

public sealed record OllamaChatResponse(bool IsSuccess, string? Content, string? ErrorMessage);

// ── Tool Calling (formato OpenAI-compatible suportado pelo Ollama) ─────────

/// <summary>
/// Mensagem extendida do Ollama com suporte a <c>tool_calls</c> (saída do assistant)
/// e <c>tool_call_id</c> (resposta de uma tool executada).
/// Compatível com <see cref="OllamaChatMessage"/> quando <c>ToolCalls</c> e
/// <c>ToolCallId</c> são null — usado apenas pra chats sem Function Calling.
/// </summary>
public sealed record OllamaMessage(
    string Role,
    string? Content,
    IReadOnlyList<OllamaToolCall>? ToolCalls = null,
    string? ToolCallId = null);

/// <summary>Definição de uma tool no catálogo enviado ao Ollama (OpenAI function-calling spec).</summary>
public sealed record OllamaTool(
    string Name,
    string Description,
    System.Text.Json.JsonElement ParametersSchema);

/// <summary>Solicitação de chamada de tool feita pelo LLM.</summary>
public sealed record OllamaToolCall(
    string Name,
    System.Text.Json.JsonElement Arguments,
    string? Id = null);

/// <summary>Resposta do chat quando tools estão habilitadas.</summary>
public sealed record OllamaChatWithToolsResponse(
    bool IsSuccess,
    string? Content,
    IReadOnlyList<OllamaToolCall>? ToolCalls,
    string? ErrorMessage);
