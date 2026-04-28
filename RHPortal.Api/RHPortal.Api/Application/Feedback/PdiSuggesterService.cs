using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

/// <summary>
/// Sugere um PDI (Plano de Desenvolvimento Individual) automaticamente a partir do
/// resultado de um ciclo de avaliação (Entrega 1.4 — Fase 1 Paridade Feedz, "a jóia da fase").
///
/// <para>Estratégia em camadas:</para>
/// <list type="number">
///   <item>Carrega respostas do funcionário no ciclo, agrega nota por pergunta</item>
///   <item>Identifica top 3-5 perguntas com nota mais baixa (gaps)</item>
///   <item>Tenta IA via <see cref="ILlmAssistantService"/> para gerar texto SMART por gap</item>
///   <item>Se IA falhar/timeout/não disponível, usa fallback heurístico determinístico</item>
/// </list>
///
/// <para>O resultado é PREVIEW — não persistido. Quem aplica é
/// <see cref="DevelopmentPlanService"/> via endpoint dedicado, depois do gestor revisar.</para>
/// </summary>
public interface IPdiSuggesterService
{
    Task<PdiSuggestionResult?> SuggestForFuncionarioAsync(Guid cicloId, Guid funcionarioId, CancellationToken ct);
}

public sealed class PdiSuggesterService : IPdiSuggesterService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ILlmAssistantService? _llm; // opcional — pode estar indisponível
    private readonly ILogger<PdiSuggesterService> _logger;

    /// <summary>Quantas metas o suggester gera, no máximo.</summary>
    private const int MaxGoals = 5;

    public PdiSuggesterService(
        AppDbContext db,
        ITenantContext tenant,
        ILogger<PdiSuggesterService> logger,
        ILlmAssistantService? llm = null)
    {
        _db = db;
        _tenant = tenant;
        _llm = llm;
        _logger = logger;
    }

    public async Task<PdiSuggestionResult?> SuggestForFuncionarioAsync(
        Guid cicloId,
        Guid funcionarioId,
        CancellationToken ct)
    {
        // 1. Carrega ciclo + perguntas
        var ciclo = await _db.AvaliacaoCiclos
            .Include(c => c.Perguntas)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cicloId, ct);

        if (ciclo is null)
            return null;

        // 2. Carrega funcionário (com cargo)
        var funcionario = await _db.Funcionarios
            .Include(f => f.JobPosition)
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == funcionarioId, ct);

        if (funcionario is null)
            return null;

        // 3. Carrega TODAS as respostas dadas SOBRE este funcionário no ciclo
        var respostas = await _db.AvaliacaoRespostas
            .Where(r => r.CicloId == cicloId && r.AvaliandoId == funcionarioId)
            .AsNoTracking()
            .ToListAsync(ct);

        if (respostas.Count == 0)
        {
            _logger.LogWarning("PdiSuggester: funcionário {FuncId} sem respostas no ciclo {CicloId}",
                funcionarioId, cicloId);
            return null;
        }

        // 4. Agrega nota média por pergunta
        var notasPorPergunta = AggregarNotasPorPergunta(respostas);

        // 5. Identifica gaps (perguntas com menor nota média)
        var gaps = IdentificarGaps(ciclo.Perguntas, notasPorPergunta);

        var scoreMedio = respostas.Average(r => r.Score);

        // 6. Tenta IA → fallback heurístico
        var (goals, source, model) = await GenerateGoalsAsync(funcionario, ciclo, gaps, scoreMedio, ct);

        var title = $"PDI {ciclo.Periodo} — {funcionario.Name}";
        var description = $"Plano de desenvolvimento gerado automaticamente a partir do ciclo \"{ciclo.Nome}\". "
            + $"Score médio: {scoreMedio:F2}. {gaps.Count} ponto(s) de desenvolvimento priorizado(s).";

        return new PdiSuggestionResult(
            FuncionarioId: funcionario.Id,
            FuncionarioNome: funcionario.Name ?? "",
            Cargo: funcionario.JobPosition?.Name,
            CicloId: ciclo.Id,
            CicloNome: ciclo.Nome,
            Title: title,
            Description: description,
            Goals: goals,
            Source: source,
            ScoreMedio: Math.Round(scoreMedio, 2),
            AiModel: model);
    }

    private sealed record GapInfo(Guid PerguntaId, string Texto, decimal NotaMedia, int TotalAvaliadores);

    private static Dictionary<Guid, (decimal Soma, int Count)> AggregarNotasPorPergunta(List<AvaliacaoResposta> respostas)
    {
        var acc = new Dictionary<Guid, (decimal Soma, int Count)>();
        foreach (var r in respostas)
        {
            if (string.IsNullOrWhiteSpace(r.RespostasJson)) continue;

            try
            {
                using var doc = JsonDocument.Parse(r.RespostasJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) continue;

                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    if (!item.TryGetProperty("perguntaId", out var pidEl)) continue;
                    if (!item.TryGetProperty("nota", out var notaEl)) continue;
                    if (!Guid.TryParse(pidEl.GetString(), out var pid)) continue;
                    var nota = notaEl.ValueKind == JsonValueKind.Number ? notaEl.GetDecimal() : 0m;

                    var prev = acc.TryGetValue(pid, out var v) ? v : (Soma: 0m, Count: 0);
                    acc[pid] = (Soma: prev.Soma + nota, Count: prev.Count + 1);
                }
            }
            catch (JsonException)
            {
                // RespostasJson corrompido — ignora silencioso, será logado pelo controller
            }
        }
        return acc;
    }

    private static List<GapInfo> IdentificarGaps(
        List<AvaliacaoPergunta> perguntas,
        Dictionary<Guid, (decimal Soma, int Count)> notasPorPergunta)
    {
        return perguntas
            .Select(p =>
            {
                if (!notasPorPergunta.TryGetValue(p.Id, out var v) || v.Count == 0)
                    return new GapInfo(p.Id, p.Texto, 0m, 0);
                return new GapInfo(p.Id, p.Texto, v.Soma / v.Count, v.Count);
            })
            .Where(g => g.TotalAvaliadores > 0) // ignora perguntas sem resposta
            .OrderBy(g => g.NotaMedia)           // pior primeiro = maior gap
            .Take(MaxGoals)
            .ToList();
    }

    private async Task<(List<PdiSuggestedGoal> Goals, string Source, string? Model)> GenerateGoalsAsync(
        Funcionario funcionario,
        AvaliacaoCiclo ciclo,
        List<GapInfo> gaps,
        decimal scoreMedio,
        CancellationToken ct)
    {
        // Tenta IA (com timeout curto pra não travar UI)
        if (_llm is not null)
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(20));

                var prompt = BuildPromptForLlm(funcionario, ciclo, gaps, scoreMedio);
                var reply = await _llm.AskAsync(
                    history: Array.Empty<AssistantChatMessage>(),
                    userMessage: prompt,
                    ct: cts.Token);

                if (reply.IsSuccess && !string.IsNullOrWhiteSpace(reply.Content))
                {
                    var parsed = TryParseLlmResponse(reply.Content, gaps);
                    if (parsed.Count > 0)
                        return (parsed, "ai", "rh-assistant");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PdiSuggester: IA falhou, usando fallback heurístico");
            }
        }

        // Fallback heurístico determinístico
        return (BuildHeuristicGoals(gaps), "heuristic", null);
    }

    private static string BuildPromptForLlm(
        Funcionario funcionario,
        AvaliacaoCiclo ciclo,
        List<GapInfo> gaps,
        decimal scoreMedio)
    {
        var gapsTxt = string.Join("\n", gaps.Select((g, i) =>
            $"{i + 1}. \"{g.Texto}\" — nota média {g.NotaMedia:F2}/5 ({g.TotalAvaliadores} avaliadores)"));

        return $$"""
        Você é um especialista em Recursos Humanos. A partir do resultado da avaliação de desempenho abaixo,
        gere {{gaps.Count}} metas SMART concretas e acionáveis para o Plano de Desenvolvimento Individual (PDI).

        Colaborador: {{funcionario.Name}}
        Cargo: {{funcionario.JobPosition?.Name ?? "(não informado)"}}
        Ciclo: {{ciclo.Nome}} ({{ciclo.Periodo}})
        Score médio geral: {{scoreMedio:F2}}/5

        Pontos com menor nota (gaps a desenvolver):
        {{gapsTxt}}

        Responda em JSON estrito com este formato (sem comentários, sem texto antes/depois):
        {
          "metas": [
            {"description": "Texto da meta SMART", "justification": "Por que essa meta resolve o gap"},
            ...
          ]
        }

        Cada meta deve:
        - Ser específica (S) e mensurável (M)
        - Ser atingível (A) e relevante (R) para o cargo
        - Ter um horizonte temporal claro de 90 a 180 dias (T)
        - Ser ACIONÁVEL (curso, projeto, mentoria, prática) — não vaga
        - Em português brasileiro, tom profissional e respeitoso
        """;
    }

    private static List<PdiSuggestedGoal> TryParseLlmResponse(string content, List<GapInfo> gaps)
    {
        // Aceita resposta dentro de ```json...``` ou puro
        var jsonStart = content.IndexOf('{');
        var jsonEnd = content.LastIndexOf('}');
        if (jsonStart < 0 || jsonEnd <= jsonStart) return new();

        var json = content[jsonStart..(jsonEnd + 1)];

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("metas", out var metasEl) || metasEl.ValueKind != JsonValueKind.Array)
                return new();

            var due = DateTimeOffset.UtcNow.AddDays(120); // horizonte 4 meses default
            var goals = new List<PdiSuggestedGoal>();
            var idx = 0;
            foreach (var m in metasEl.EnumerateArray())
            {
                var desc = m.TryGetProperty("description", out var d) ? d.GetString() : null;
                var just = m.TryGetProperty("justification", out var j) ? j.GetString() : null;
                if (string.IsNullOrWhiteSpace(desc)) continue;

                goals.Add(new PdiSuggestedGoal(
                    Description: desc.Trim(),
                    DueDate: due,
                    Order: idx + 1,
                    Justification: just?.Trim()));
                idx++;
            }
            return goals;
        }
        catch (JsonException)
        {
            return new();
        }
    }

    private static List<PdiSuggestedGoal> BuildHeuristicGoals(List<GapInfo> gaps)
    {
        // Templates determinísticos por nível de gap
        var due = DateTimeOffset.UtcNow.AddDays(120);
        var goals = new List<PdiSuggestedGoal>();

        for (int i = 0; i < gaps.Count; i++)
        {
            var g = gaps[i];
            // Nota baixa (< 3) = gap forte; nota média (3-3.9) = gap moderado
            var prefixo = g.NotaMedia < 3m
                ? "Desenvolver de forma estruturada"
                : "Aprimorar a prática de";

            var desc = $"{prefixo} \"{g.Texto.TrimEnd('.')}\" — definir 2 ações concretas (curso, projeto ou mentoria) "
                + "e ter um marco de progresso visível em até 4 meses.";

            var just = g.NotaMedia < 3m
                ? $"Avaliação apontou nota {g.NotaMedia:F1}/5 — gap relevante a endereçar com ações concretas."
                : $"Avaliação apontou nota {g.NotaMedia:F1}/5 — espaço de evolução claro, mas não crítico.";

            goals.Add(new PdiSuggestedGoal(
                Description: desc,
                DueDate: due,
                Order: i + 1,
                Justification: just));
        }

        return goals;
    }
}
