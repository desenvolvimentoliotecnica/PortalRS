using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pgvector.EntityFrameworkCore;
using RhPortal.Api.Application.Ai.Agent;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Implementação do <see cref="ILlmAssistantService"/>: faz RAG sobre descrições
/// de cargo (+ itens + vagas) e candidatos, monta um prompt estruturado e dispara
/// o Qwen via <see cref="IOllamaClient"/>.
///
/// <para><b>Estratégia de recuperação</b>:</para>
/// <list type="number">
///   <item>Busca top-10 itens DNALIO semanticamente próximos da pergunta</item>
///   <item>Busca top-5 vagas abertas com descrição próxima</item>
///   <item>Injeta como contexto numerado no prompt</item>
///   <item>Instrui LLM a citar fontes pelo número</item>
/// </list>
/// </summary>
public sealed class LlmAssistantService : ILlmAssistantService
{
    private readonly IOllamaClient _ollama;
    private readonly IVectorSearchService _vectorSearch;
    private readonly AppDbContext _db;
    private readonly IAgentToolRegistry _toolRegistry;
    private readonly ILogger<LlmAssistantService> _logger;

    /// <summary>Limite de iterações do loop ReAct (tool → LLM → tool → …) pra evitar infinite loop.</summary>
    private const int MaxAgentIterations = 6;

    private const string SystemPrompt = """
        Você é o Assistente RH da Liotécnica — agente interno com acesso ao banco de dados via ferramentas.

        REGRA FUNDAMENTAL: para QUALQUER pergunta que envolva dados concretos do sistema (números, listas,
        status, filtros, relações entre entidades), VOCÊ DEVE invocar uma FERRAMENTA (tool) antes de responder.
        NÃO responda contando com o "contexto recuperado" — ele é apenas sugestivo. A verdade está nas tools.

        QUANDO USAR CADA TOOL (mapeamento intenção → ferramenta):
        - "quantas/quantos/total de X" → tool de contagem (vagas_contar, candidatos_contar, etc)
        - "liste/mostre/quais X" → tool de listagem (vagas_listar, candidatos_listar)
        - "detalhes/informações sobre X" → tool de info (vagas_info, candidatos_info, descricao_cargo_info)
        - "distribuição/funil/por etapa" → candidaturas_por_etapa
        - "candidatos da vaga Y" → vagas_candidatos
        - "atrasos/SLA/parado" → candidaturas_sla_atrasadas
        - "propostas" → propostas_listar ou propostas_estatisticas
        - "centros de custo/departamentos/áreas" → centros_custo_listar
        - "descrições de cargo/cargos" → descricoes_cargo_listar

        PROCESSO:
        1. Leia a pergunta do usuário.
        2. Se precisa de dados → invoque tool (pode ser mais de uma).
        3. Use o resultado REAL da tool para responder.
        4. Responda em PT-BR, claro e objetivo. NUNCA invente dados.

        Se a pergunta for conceitual (resumos, explicações teóricas sem dados concretos do tenant),
        use o Contexto recuperado citando [Fonte N].
        """;

    public LlmAssistantService(
        IOllamaClient ollama,
        IVectorSearchService vectorSearch,
        AppDbContext db,
        IAgentToolRegistry toolRegistry,
        ILogger<LlmAssistantService> logger)
    {
        _ollama = ollama;
        _vectorSearch = vectorSearch;
        _db = db;
        _toolRegistry = toolRegistry;
        _logger = logger;
    }

    public async IAsyncEnumerable<string> AskStreamAsync(
        IReadOnlyList<AssistantChatMessage> history,
        string userMessage,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var (context, _) = await BuildContextAsync(userMessage, ct);
        var messages = BuildPromptMessages(history, userMessage, context);
        await foreach (var chunk in _ollama.ChatStreamAsync(messages, new OllamaChatOptions(Temperature: 0.3, SystemPrompt: SystemPrompt), ct))
        {
            yield return chunk;
        }
    }

    public async Task<AssistantReply> AskAsync(
        IReadOnlyList<AssistantChatMessage> history,
        string userMessage,
        CancellationToken ct = default)
    {
        // 1. Retrieval RAG
        var (context, fontes) = await BuildContextAsync(userMessage, ct);

        // 2. Monta tools disponíveis
        var toolsForLlm = _toolRegistry.All
            .Select(t => new OllamaTool(t.Name, t.Description, t.ParametersSchema))
            .ToList();

        // 3. Monta histórico + contexto RAG + pergunta atual
        var messages = new List<OllamaMessage>();
        foreach (var m in history.TakeLast(12))
            messages.Add(new OllamaMessage(m.Role, m.Content));

        messages.Add(new OllamaMessage(
            "user",
            $"{context}\n\n═══ PERGUNTA ═══\n{userMessage}"));

        // 4. Loop Agent ReAct — até MaxAgentIterations ou LLM responder sem tool_calls
        var toolsUsadas = new List<AssistantToolInvocation>();
        var options = new OllamaChatOptions(Temperature: 0.2, SystemPrompt: SystemPrompt, MaxTokens: 2048);

        for (int iter = 0; iter < MaxAgentIterations; iter++)
        {
            var resp = await _ollama.ChatWithToolsAsync(messages, toolsForLlm, options, ct);
            if (!resp.IsSuccess)
                return new AssistantReply(false, "", fontes, toolsUsadas, resp.ErrorMessage);

            var hasToolCalls = resp.ToolCalls is { Count: > 0 };
            var content = resp.Content ?? "";

            // Se não há tool calls, LLM deu resposta final
            if (!hasToolCalls)
            {
                // Se content também está vazio e já executamos tools, forçar 1 iteração extra
                // pedindo sintetizar — Qwen às vezes responde content vazio após tool sem sintetizar.
                if (string.IsNullOrWhiteSpace(content) && toolsUsadas.Count > 0 && iter < MaxAgentIterations - 1)
                {
                    _logger.LogInformation("[Assistant] Content vazio após {N} tools — pedindo síntese explícita", toolsUsadas.Count);
                    messages.Add(new OllamaMessage(
                        "user",
                        "Agora, com base nos resultados das ferramentas acima, responda a pergunta original em PT-BR de forma clara e objetiva."));
                    continue;
                }
                return new AssistantReply(
                    true,
                    string.IsNullOrWhiteSpace(content)
                        ? "Não consegui gerar uma resposta. Tente reformular a pergunta."
                        : content,
                    fontes, toolsUsadas);
            }

            // Adiciona a mensagem do assistant com as tool_calls ao histórico
            messages.Add(new OllamaMessage("assistant", resp.Content ?? "", resp.ToolCalls));

            // Executa cada tool solicitada e adiciona o resultado como role=tool
            foreach (var tc in resp.ToolCalls!)
            {
                var tool = _toolRegistry.FindByName(tc.Name);
                string resultJson;
                string preview;
                var sw = Stopwatch.StartNew();

                if (tool is null)
                {
                    resultJson = JsonSerializer.Serialize(new { erro = $"Ferramenta '{tc.Name}' não existe." });
                    preview = $"Ferramenta '{tc.Name}' não encontrada";
                }
                else
                {
                    try
                    {
                        _logger.LogInformation("[Assistant] Executando tool {Tool} com args {Args}",
                            tc.Name, tc.Arguments.GetRawText());
                        var result = await tool.ExecuteAsync(tc.Arguments, ct);
                        resultJson = JsonSerializer.Serialize(result, new JsonSerializerOptions
                        {
                            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                        });
                        preview = resultJson.Length > 300 ? resultJson.Substring(0, 300) + "..." : resultJson;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[Assistant] Falha ao executar tool {Tool}", tc.Name);
                        resultJson = JsonSerializer.Serialize(new { erro = ex.Message });
                        preview = $"Erro: {ex.Message}";
                    }
                }
                sw.Stop();

                toolsUsadas.Add(new AssistantToolInvocation(
                    tc.Name,
                    tool?.Description ?? "(tool desconhecida)",
                    tc.Arguments.GetRawText(),
                    preview,
                    (int)sw.ElapsedMilliseconds));

                // Mensagem de resposta da tool na conversa — LLM vai usar no próximo ciclo
                messages.Add(new OllamaMessage("tool", resultJson, null, tc.Id ?? tc.Name));
            }
            // Loop volta — LLM recebe resultado das tools e decide: chamar mais tools ou responder
        }

        // Safeguard: estourou iterações sem resposta final
        return new AssistantReply(
            true,
            "Atingi o limite de consultas internas ao banco. Tente reformular a pergunta de forma mais específica.",
            fontes,
            toolsUsadas,
            null);
    }

    /// <summary>
    /// RAG retrieval: monta contexto numerado agregando 3 fontes paralelas.
    ///
    /// <list type="number">
    ///   <item><b>Itens DNALIO</b> (top-6) — similaridade semântica via
    ///         <c>DescricaoCargoItemEmbeddings</c></item>
    ///   <item><b>Candidatos</b> (top-5) — similaridade semântica via
    ///         <c>CandidatoEmbeddings</c>; quando a pergunta cita "candidato/perfil/quem"
    ///         aumenta o top-K para 10</item>
    ///   <item><b>Vagas abertas</b> (top-3) — match léxico por keywords</item>
    /// </list>
    ///
    /// <para>Todos os 3 retrievals rodam em paralelo para minimizar latência.
    /// Contexto final é texto Markdown estruturado; cada fonte recebe
    /// <c>[Fonte N]</c> sequencial para o LLM poder citar.</para>
    /// </summary>
    private async Task<(string context, IReadOnlyList<SemanticEvidence> fontes)> BuildContextAsync(string userMessage, CancellationToken ct)
    {
        var fontes = new List<SemanticEvidence>();
        var sb = new StringBuilder();
        sb.AppendLine("═══ CONTEXTO (fontes recuperadas) ═══");

        // Detecta intenção: se a pergunta é claramente estruturada (counts, listas, funil),
        // reduz drasticamente o RAG para não poluir o contexto e incentivar o LLM a chamar tools.
        var normMsg = (userMessage ?? "").ToLowerInvariant();
        bool perguntaEstruturada =
            normMsg.Contains("quantos") || normMsg.Contains("quantas") ||
            normMsg.Contains("total de") || normMsg.Contains("contar") ||
            normMsg.Contains("por etapa") || normMsg.Contains("por status") ||
            normMsg.Contains("por fonte") || normMsg.Contains("distribui") ||
            normMsg.Contains("funil") ||
            normMsg.Contains("estatisti") ||
            normMsg.Contains("sla") || normMsg.Contains("atrasad") ||
            (normMsg.Contains("liste") && (normMsg.Contains("vaga") || normMsg.Contains("candid") || normMsg.Contains("propost")));
        bool perguntaCandidatos =
            normMsg.Contains("candidat") ||
            normMsg.Contains("perfil") ||
            normMsg.Contains("pessoa") ||
            normMsg.Contains("quem ") ||
            normMsg.Contains("liste") ||
            normMsg.Contains("nome");
        int topCands = perguntaEstruturada ? 0 : (perguntaCandidatos ? 12 : 5);
        int topItens = perguntaEstruturada ? 0 : (perguntaCandidatos ? 4 : 8);

        // Rodadas sequenciais — DbContext não é thread-safe, não pode paralelizar no mesmo scope.
        // Cada query é rápida (<100ms); o custo real é o Ollama na próxima etapa.
        var topItems = await _vectorSearch.SearchItemsByTextAsync(userMessage, topK: topItens, ct: ct);
        var topCandidatos = await SearchCandidatosByTextAsync(userMessage, topK: topCands, ct: ct);
        var vagasAbertas = await SearchVagasAbertasAsync(userMessage, ct);

        int fonteIdx = 1;

        // ── Bloco 1: Itens DNALIO ───────────────────────────────────────────
        if (topItems.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("### Descrições de Cargo (itens DNALIO)");
            foreach (var m in topItems)
            {
                var titulo = await _db.DescricoesCargo.AsNoTracking()
                    .Where(d => d.Id == m.DescricaoCargoId)
                    .Select(d => d.Title)
                    .FirstOrDefaultAsync(ct) ?? "desconhecido";
                sb.AppendLine($"[Fonte {fonteIdx}] Cargo \"{titulo}\" · {m.Categoria}" +
                              (m.Subcategoria is null ? "" : $" / {m.Subcategoria}") +
                              $" · similaridade {m.SimilarityScore:F2}");
                sb.AppendLine($"   → {m.Texto}");
                fontes.Add(new SemanticEvidence(m.Categoria.ToString(), m.Subcategoria, m.Texto, m.SimilarityScore));
                fonteIdx++;
            }
        }

        // ── Bloco 2: Candidatos ─────────────────────────────────────────────
        if (topCandidatos.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("### Candidatos (busca semântica por CV)");
            foreach (var c in topCandidatos)
            {
                var vagaLabel = c.VagaTitulo ?? "—";
                sb.AppendLine($"[Fonte {fonteIdx}] Candidato \"{c.Nome}\" — {c.Cidade}/{c.Uf} · vaga={vagaLabel} · status={c.Status} · similaridade {c.SimilarityScore:F2}");
                if (!string.IsNullOrEmpty(c.Resumo))
                    sb.AppendLine($"   → Resumo: {c.Resumo}");
                if (!string.IsNullOrEmpty(c.CvSnippet))
                    sb.AppendLine($"   → CV (início): {c.CvSnippet}");
                fontes.Add(new SemanticEvidence("Candidato", null, $"{c.Nome} — {c.Cidade}/{c.Uf}", c.SimilarityScore));
                fonteIdx++;
            }
        }

        // ── Bloco 3: Vagas em aberto ────────────────────────────────────────
        if (vagasAbertas.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("### Vagas em aberto relacionadas");
            foreach (var v in vagasAbertas)
            {
                sb.AppendLine($"[Fonte {fonteIdx}] Vaga {v.Codigo} — {v.Titulo} ({v.Cidade}/{v.Uf})" +
                              (v.SalarioMinimo.HasValue
                                  ? $" · faixa R$ {v.SalarioMinimo:N2} – R$ {v.SalarioMaximo:N2}"
                                  : ""));
                fontes.Add(new SemanticEvidence("Vaga", null, $"{v.Codigo} · {v.Titulo}", 1.0));
                fonteIdx++;
            }
        }

        if (fontes.Count == 0)
        {
            sb.AppendLine();
            sb.AppendLine("(Nenhuma fonte relevante encontrada no banco.)");
        }

        return (sb.ToString(), fontes);
    }

    /// <summary>
    /// Retrieve semântico de candidatos: gera embedding da pergunta via Ollama,
    /// faz kNN cosine contra <c>CandidatoEmbeddings</c>. Junta com dados do candidato
    /// (Nome, Cidade, Vaga atual, Status) para dar contexto ao LLM.
    /// </summary>
    private async Task<List<CandidatoHit>> SearchCandidatosByTextAsync(string query, int topK, CancellationToken ct)
    {
        var queryVec = await _ollama.EmbedAsync(query, ct);
        if (queryVec is null) return new List<CandidatoHit>();

        var q = new Pgvector.Vector(queryVec);
        var rows = await _db.CandidatoEmbeddings
            .AsNoTracking()
            .Where(e => e.Embedding != null)
            .Join(_db.Candidatos.AsNoTracking(),
                  e => e.CandidatoId,
                  c => c.Id,
                  (e, c) => new { e, c })
            .OrderBy(x => x.e.Embedding!.CosineDistance(q))
            .Take(topK)
            .Select(x => new
            {
                x.c.Id,
                x.c.Nome,
                x.c.Cidade,
                x.c.Uf,
                x.c.Status,
                x.c.VagaId,
                x.c.CvText,
                x.c.ResumoProfissional,
                Distance = x.e.Embedding!.CosineDistance(q),
            })
            .ToListAsync(ct);

        if (!rows.Any()) return new List<CandidatoHit>();

        // Busca títulos das vagas referenciadas (1 query extra)
        var vagaIds = rows.Where(r => r.VagaId.HasValue).Select(r => r.VagaId!.Value).Distinct().ToList();
        var vagaTitles = await _db.Vagas.AsNoTracking()
            .Where(v => vagaIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, v => v.Titulo, ct);

        return rows.Select(r => new CandidatoHit(
            r.Id, r.Nome,
            r.Cidade ?? "—",
            r.Uf ?? "—",
            r.Status.ToString(),
            r.VagaId.HasValue && vagaTitles.TryGetValue(r.VagaId.Value, out var t) ? t : null,
            Truncate(r.ResumoProfissional, 200),
            Truncate(r.CvText, 400),
            Math.Max(0, 1.0 - r.Distance)
        )).ToList();
    }

    private async Task<List<VagaAbertaHit>> SearchVagasAbertasAsync(string userMessage, CancellationToken ct)
    {
        var keywords = (userMessage ?? "")
            .Split(new[] { ' ', ',', '.', '?', '!' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 4)
            .Take(4)
            .ToList();
        if (keywords.Count == 0) return new List<VagaAbertaHit>();

        var q = _db.Vagas.AsNoTracking()
            .Where(v => v.Status == RHPortal.Api.Domain.Enums.VagaStatus.Aberta);
        foreach (var kw in keywords)
        {
            var local = kw;
            q = q.Where(v => EF.Functions.ILike(v.Titulo, $"%{local}%") || EF.Functions.ILike(v.DescricaoInterna ?? "", $"%{local}%"));
        }
        var rows = await q.Take(3)
            .Select(v => new VagaAbertaHit(v.Codigo ?? "", v.Titulo, v.Cidade, v.Uf, v.SalarioMinimo, v.SalarioMaximo))
            .ToListAsync(ct);
        return rows;
    }

    private static string Truncate(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Length <= max ? s : s.Substring(0, max) + "...";
    }

    private sealed record CandidatoHit(
        Guid Id, string Nome, string Cidade, string Uf, string Status,
        string? VagaTitulo, string Resumo, string CvSnippet, double SimilarityScore);

    private sealed record VagaAbertaHit(
        string Codigo, string Titulo, string? Cidade, string? Uf,
        decimal? SalarioMinimo, decimal? SalarioMaximo);

    private static List<OllamaChatMessage> BuildPromptMessages(
        IReadOnlyList<AssistantChatMessage> history,
        string userMessage,
        string context)
    {
        var messages = new List<OllamaChatMessage>();
        // Histórico resumido (últimas 6 trocas)
        foreach (var m in history.TakeLast(12))
        {
            messages.Add(new OllamaChatMessage(m.Role, m.Content));
        }
        // Mensagem atual com contexto RAG embutido
        messages.Add(new OllamaChatMessage(
            "user",
            $"{context}\n\n═══ PERGUNTA ═══\n{userMessage}"));
        return messages;
    }
}
