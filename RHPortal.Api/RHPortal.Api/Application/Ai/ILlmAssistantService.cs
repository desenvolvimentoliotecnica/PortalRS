using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using RhPortal.Api.Application.Matching;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Chatbot RAG do RH. Responde perguntas sobre candidatos, vagas, descrições de
/// cargo e políticas salariais usando:
///   1. Retrieval: busca semântica no pgvector pra trazer contexto relevante
///   2. Augmentation: injeta contexto + pergunta num prompt estruturado
///   3. Generation: Ollama (Qwen 2.5) gera resposta em pt-br
///
/// <para>Suporta streaming para UX de chat (token a token) e modo buffered para
/// resposta completa em JSON único.</para>
/// </summary>
public interface ILlmAssistantService
{
    /// <summary>
    /// Streaming de resposta para uma mensagem de chat do usuário, com contexto
    /// completo da conversa. Cada yield é um chunk de texto gerado.
    /// </summary>
    IAsyncEnumerable<string> AskStreamAsync(
        IReadOnlyList<AssistantChatMessage> history,
        string userMessage,
        CancellationToken ct = default);

    /// <summary>
    /// Resposta completa não-streaming — para cenários de automação/teste.
    /// </summary>
    Task<AssistantReply> AskAsync(
        IReadOnlyList<AssistantChatMessage> history,
        string userMessage,
        CancellationToken ct = default);
}

public sealed record AssistantChatMessage(string Role, string Content);

public sealed record AssistantReply(
    bool IsSuccess,
    string Content,
    /// <summary>Trechos de DescricaoCargo que foram usados como contexto (transparência).</summary>
    IReadOnlyList<SemanticEvidence>? Fontes = null,
    /// <summary>Ferramentas executadas pelo agente (transparência — mostra ao usuário que consulta ao banco foi feita).</summary>
    IReadOnlyList<AssistantToolInvocation>? ToolsUsadas = null,
    string? ErrorMessage = null);

/// <summary>Registro de uma invocação de tool pelo agente — mostrado na UI.</summary>
public sealed record AssistantToolInvocation(
    string Name,
    string Description,
    /// <summary>Argumentos em JSON (serializado).</summary>
    string ArgsJson,
    /// <summary>Pré-visualização compacta do resultado (truncado ~300 chars).</summary>
    string ResultPreview,
    int DurationMs);
