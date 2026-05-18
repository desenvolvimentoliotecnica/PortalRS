using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.DescricaoCargo;
using RhPortal.Api.Infrastructure.Filters;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Endpoints do Assistente RH — funções de IA (Ollama + RAG):
///   POST /api/assistente-ia/chat             — chat síncrono com RAG
///   GET  /api/assistente-ia/chat/stream      — chat streaming (SSE)
///   POST /api/assistente-ia/descricao-cargo/gerar  — gera template DNALIO
///   POST /api/assistente-ia/cv/resumir/{id}  — resume CV do candidato
///   POST /api/assistente-ia/vagas/sugerir-salario/{id}  — sugere faixa salarial
///   POST /api/assistente-ia/embeddings/reindexar  — re-indexa embeddings do tenant
///   GET  /api/assistente-ia/health           — status do stack IA (Ollama, modelos, vetores)
/// </summary>
[ApiController]
[Route("api/assistente-ia")]
[Authorize]
public sealed class AssistenteIaController : ControllerBase
{
    [HttpGet("health")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Health(
        [FromServices] IOllamaClient ollama,
        [FromServices] ITenantAiSettingsResolver tenantAi,
        CancellationToken ct)
    {
        var h = await ollama.CheckHealthAsync(ct);
        var tenant = await tenantAi.GetCurrentAsync(ct);
        var embProvider = tenant?.EmbeddingProvider ?? tenant?.LlmProvider ?? "gemini";
        return Ok(new
        {
            ollama = new
            {
                reachable = h.IsReachable,
                hasChatModel = h.HasChatModel,
                hasEmbeddingModel = h.HasEmbeddingModel,
                error = h.ErrorMessage,
            },
            embedding = new
            {
                provider = embProvider,
                model = tenant?.EmbeddingModel,
                usesCloudGemini = string.Equals(embProvider, "gemini", StringComparison.OrdinalIgnoreCase),
            }
        });
    }

    [HttpPost("chat")]
    [RequireAiModule]
    [ProducesResponseType(typeof(AssistantReply), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Chat(
        [FromBody] ChatRequest request,
        [FromServices] ILlmAssistantService assistant,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "Mensagem é obrigatória." });
        var history = request.History ?? new List<AssistantChatMessage>();
        var reply = await assistant.AskAsync(history, request.Message, ct);
        return Ok(reply);
    }

    /// <summary>
    /// Chat streaming via Server-Sent Events. Cada chunk é uma linha
    /// <c>data: {json}</c>, terminando com <c>data: [DONE]</c>.
    /// </summary>
    [HttpPost("chat/stream")]
    [RequireAiModule]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task ChatStream(
        [FromBody] ChatRequest request,
        [FromServices] ILlmAssistantService assistant,
        CancellationToken ct)
    {
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");
        Response.Headers.Append("X-Accel-Buffering", "no");

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            await WriteEvent(new { error = "Mensagem é obrigatória." }, ct);
            await WriteDone(ct);
            return;
        }

        var history = request.History ?? new List<AssistantChatMessage>();
        try
        {
            await foreach (var chunk in assistant.AskStreamAsync(history, request.Message, ct))
            {
                if (ct.IsCancellationRequested) break;
                await WriteEvent(new { delta = chunk }, ct);
            }
        }
        catch (Exception ex)
        {
            await WriteEvent(new { error = ex.Message }, ct);
        }
        finally
        {
            await WriteDone(ct);
        }
    }

    private async Task WriteEvent(object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload);
        var bytes = Encoding.UTF8.GetBytes($"data: {json}\n\n");
        await Response.Body.WriteAsync(bytes, 0, bytes.Length, ct);
        await Response.Body.FlushAsync(ct);
    }

    private async Task WriteDone(CancellationToken ct)
    {
        var bytes = Encoding.UTF8.GetBytes("data: [DONE]\n\n");
        await Response.Body.WriteAsync(bytes, 0, bytes.Length, ct);
        await Response.Body.FlushAsync(ct);
    }

    [HttpPost("descricao-cargo/gerar")]
    [RequireAiModule]
    [ProducesResponseType(typeof(DescricaoCargoGenerationResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GerarDescricaoCargo(
        [FromBody] GenerateDescricaoCargoRequest request,
        [FromServices] IDescricaoCargoGeneratorService gen,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Titulo))
            return BadRequest(new { message = "Título é obrigatório." });

        var result = await gen.GenerateAsync(request.Titulo, request.ContextoAdicional, request.AreaOuDepartamento, ct);
        return Ok(result);
    }

    [HttpPost("cv/resumir/{candidatoId:guid}")]
    [RequireAiModule]
    [ProducesResponseType(typeof(CvResumoResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> ResumirCv(
        [FromRoute] Guid candidatoId,
        [FromQuery] bool force,
        [FromServices] ICvResumoService resumo,
        CancellationToken ct)
    {
        var result = await resumo.ResumirAsync(candidatoId, force, ct);
        if (!result.IsSuccess) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("vagas/sugerir-salario/{vagaId:guid}")]
    [RequireAiModule]
    [ProducesResponseType(typeof(SalarioSuggestionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> SugerirSalario(
        [FromRoute] Guid vagaId,
        [FromServices] ISalarioSuggesterService salario,
        CancellationToken ct)
    {
        var result = await salario.SuggerirAsync(vagaId, ct);
        if (!result.IsSuccess) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("embeddings/reindexar")]
    [RequireAiModule]
    [ProducesResponseType(typeof(IndexingStats), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Reindexar(
        [FromQuery] bool force,
        [FromServices] IEmbeddingService embedding,
        CancellationToken ct)
    {
        var stats = await embedding.IndexTenantAsync(force, ct);
        return Ok(stats);
    }
}

public sealed record ChatRequest(
    string Message,
    IReadOnlyList<AssistantChatMessage>? History = null);

public sealed record GenerateDescricaoCargoRequest(
    string Titulo,
    string? AreaOuDepartamento,
    string? ContextoAdicional);
