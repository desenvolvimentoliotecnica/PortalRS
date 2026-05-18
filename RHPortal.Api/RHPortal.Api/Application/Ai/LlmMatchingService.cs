using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Implementação do LLM-as-a-Judge: monta prompt estruturado com DescCargo DNALIO
/// + CV + pesos, chama o provider do tenant via <see cref="IUnifiedAiService"/>
/// (Gemini/OpenAI/Anthropic) ou <see cref="IOllamaClient"/> quando <c>LlmProvider=ollama</c>,
/// parseia JSON e persiste em <see cref="CandidatoVagaLlmScore"/>.
///
/// <para><b>Pipeline</b>:
/// <list type="number">
///   <item>Carrega Vaga + DescCargo + Itens + Candidato + Competências</item>
///   <item>Gera hash de entrada (CV texto + DescCargo hash + pesos + MatchMinimo)</item>
///   <item>Se cache com mesmo hash existe, retorna imediatamente</item>
///   <item>Monta prompt system (regras) + user (dados estruturados em Markdown)</item>
///   <item>Chama Qwen em temperatura 0.1 + format=json</item>
///   <item>Parseia JSON estruturado, valida, persiste</item>
/// </list>
/// </para>
/// </summary>
public sealed class LlmMatchingService : ILlmMatchingService
{
    private readonly AppDbContext _db;
    private readonly IOllamaClient _ollama;
    private readonly IUnifiedAiService _unifiedAi;
    private readonly ITenantAiSettingsResolver _tenantAi;
    private readonly AiOptions _aiOptions;
    private readonly OllamaOptions _ollamaOptions;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<LlmMatchingService> _logger;

    public LlmMatchingService(
        AppDbContext db,
        IOllamaClient ollama,
        IUnifiedAiService unifiedAi,
        ITenantAiSettingsResolver tenantAi,
        IOptions<AiOptions> aiOptions,
        ITenantContext tenantContext,
        ILogger<LlmMatchingService> logger)
    {
        _db = db;
        _ollama = ollama;
        _unifiedAi = unifiedAi;
        _tenantAi = tenantAi;
        _aiOptions = aiOptions.Value;
        _ollamaOptions = aiOptions.Value.Ollama;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    public async Task<LlmMatchingResult?> GetCachedScoreAsync(Guid candidatoId, Guid vagaId, CancellationToken ct = default)
    {
        var ctx = await LoadScoreContextAsync(candidatoId, vagaId, ct);
        if (ctx is null) return null;

        var effectiveModel = await ResolveEffectiveLlmModelAsync(ct);
        return await TryGetValidCacheAsync(candidatoId, vagaId, ctx.InputHash, effectiveModel, ct);
    }

    public async Task<LlmMatchingResult?> ScoreAsync(Guid candidatoId, Guid vagaId, bool force = false, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";

        var ctx = await LoadScoreContextAsync(candidatoId, vagaId, ct);
        if (ctx is null) return null;

        var (vaga, candidato, competencias, inputHash) = ctx;
        var effectiveModel = await ResolveEffectiveLlmModelAsync(ct);

        // ── Cache check ──────────────────────────────────────────────────
        if (!force)
        {
            var cached = await TryGetValidCacheAsync(candidatoId, vagaId, inputHash, effectiveModel, ct);
            if (cached is not null)
            {
                _logger.LogDebug("[LlmMatching] Cache hit para cand={Cand} vaga={Vaga}", candidatoId, vagaId);
                return cached;
            }
        }

        // ── 4. Monta prompt ────────────────────────────────────────────────
        var (systemPrompt, userPrompt) = BuildPrompts(vaga, candidato, competencias);

        // ── 5. Chama LLM (provider do tenant) ───────────────────────────────
        var sw = Stopwatch.StartNew();
        var (rawContent, modelUsed) = await InvokeJudgeLlmAsync(
            tenantId, systemPrompt, userPrompt, effectiveModel, ct);
        sw.Stop();

        if (string.IsNullOrWhiteSpace(rawContent))
        {
            _logger.LogWarning("[LlmMatching] LLM retornou vazio após {Elapsed}ms (model={Model})",
                sw.ElapsedMilliseconds, modelUsed);
            throw new LlmTimeoutException(
                $"O modelo de IA ({modelUsed}) não respondeu em {sw.ElapsedMilliseconds / 1000}s. " +
                "Verifique a chave do provider (Owner → IA) e a configuração em Admin → IA do tenant. Tente novamente.");
        }

        var parsed = TryParseJson(rawContent);
        if (parsed is null)
        {
            _logger.LogWarning("[LlmMatching] JSON inválido do LLM (len={Len}):\n{Content}",
                rawContent.Length, rawContent);
            throw new LlmTimeoutException("O modelo retornou resposta em formato inesperado. Tente regenerar.");
        }

        // ── 6. Valida pesos e normaliza score final ─────────────────────────
        var matchMin = Math.Clamp(vaga.MatchMinimoPercentual, 0, 100);
        var passou = parsed.ScoreFinal >= matchMin;

        // ── 7. Persiste no cache ───────────────────────────────────────────
        await UpsertCacheAsync(tenantId, candidatoId, vagaId, parsed, passou, inputHash, modelUsed, (int)sw.ElapsedMilliseconds, ct);

        return new LlmMatchingResult(
            candidatoId, vagaId,
            parsed.ScoreFinal,
            passou,
            parsed.Justificativa ?? "",
            parsed.Criterios?.Select(c => new LlmCriterio(
                c.Nome ?? "",
                c.Peso,
                c.Score,
                (decimal)Math.Round(c.Peso * c.Score / 100.0, 1),
                c.PontosFortes ?? new List<string>(),
                c.Gaps ?? new List<string>()
            )).ToList() ?? new List<LlmCriterio>(),
            parsed.PontosFortes ?? new List<string>(),
            parsed.Gaps ?? new List<string>(),
            modelUsed,
            (int)sw.ElapsedMilliseconds,
            UsouCache: false);
    }

    private sealed record ScoreContext(
        RHPortal.Api.Domain.Entities.Vaga Vaga,
        Candidato Candidato,
        IReadOnlyList<string> Competencias,
        string InputHash);

    private async Task<ScoreContext?> LoadScoreContextAsync(Guid candidatoId, Guid vagaId, CancellationToken ct)
    {
        var vaga = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.DescricaoCargo)
                .ThenInclude(d => d!.Itens)
            .FirstOrDefaultAsync(v => v.Id == vagaId, ct);

        if (vaga is null || vaga.DescricaoCargo is null) return null;

        var candidato = await _db.Candidatos
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == candidatoId, ct);
        if (candidato is null) return null;

        var competencias = await _db.CandidatoCompetencias
            .AsNoTracking()
            .Where(x => x.CandidatoId == candidatoId)
            .Select(x => x.Nome)
            .ToListAsync(ct);

        var inputHash = ComputeInputHash(vaga, candidato, competencias);
        return new ScoreContext(vaga, candidato, competencias, inputHash);
    }

    private async Task<LlmMatchingResult?> TryGetValidCacheAsync(
        Guid candidatoId,
        Guid vagaId,
        string inputHash,
        string effectiveModel,
        CancellationToken ct)
    {
        var cached = await _db.CandidatoVagaLlmScores
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.VagaId == vagaId && x.CandidatoId == candidatoId, ct);
        if (cached is null
            || cached.InputHash != inputHash
            || !string.Equals(cached.ModelVersion, effectiveModel, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return ResultFromEntity(cached, usouCache: true);
    }

    private async Task<string> ResolveEffectiveLlmProviderAsync(CancellationToken ct)
    {
        var settings = await _tenantAi.GetCurrentAsync(ct);
        if (!string.IsNullOrWhiteSpace(settings?.LlmProvider))
            return settings.LlmProvider.Trim().ToLowerInvariant();

        var fallback = _aiOptions.DefaultProvider?.Trim();
        return string.IsNullOrWhiteSpace(fallback) ? "openai" : fallback.ToLowerInvariant();
    }

    private async Task<string> ResolveEffectiveLlmModelAsync(CancellationToken ct)
    {
        var settings = await _tenantAi.GetCurrentAsync(ct);
        if (!string.IsNullOrWhiteSpace(settings?.LlmModel))
            return settings.LlmModel.Trim();

        var provider = await ResolveEffectiveLlmProviderAsync(ct);
        return provider switch
        {
            "gemini" => _aiOptions.Gemini?.DefaultModel ?? "gemini-2.5-flash",
            "anthropic" => _aiOptions.Anthropic?.DefaultModel ?? "claude-3-5-sonnet-20241022",
            "ollama" => _ollamaOptions.ChatModel ?? "qwen2.5:7b",
            _ => _aiOptions.OpenAI?.DefaultModel ?? "gpt-4o-mini",
        };
    }

    private async Task<(string? Content, string ModelUsed)> InvokeJudgeLlmAsync(
        string tenantId,
        string systemPrompt,
        string userPrompt,
        string effectiveModel,
        CancellationToken ct)
    {
        var provider = await ResolveEffectiveLlmProviderAsync(ct);

        if (provider == "ollama")
        {
            var health = await _ollama.CheckHealthAsync(ct);
            if (!health.IsReachable || !health.HasChatModel)
            {
                _logger.LogInformation("[LlmMatching] Ollama indisponível — score LLM não computado. {Err}", health.ErrorMessage);
                return (null, effectiveModel);
            }

            var messages = new List<OllamaChatMessage> { new("user", userPrompt) };
            var resp = await _ollama.ChatAsync(messages,
                new OllamaChatOptions(Temperature: 0.1, SystemPrompt: systemPrompt, MaxTokens: 2000),
                ct);
            if (!resp.IsSuccess)
                return (null, _ollamaOptions.ChatModel ?? effectiveModel);
            return (resp.Content, _ollamaOptions.ChatModel ?? effectiveModel);
        }

        var payload = new { prompt = systemPrompt, cvText = userPrompt };
        var request = new AiInvokeRequest(
            Module: "LlmMatching",
            ActionDescription: "Avaliação candidato × vaga (LLM-as-Judge)",
            RequestMessage: null,
            ModelId: null,
            Payload: payload);

        var outcome = await _unifiedAi.InvokeWithOutcomeAsync(tenantId, null, "LlmMatching", request, ct);
        if (outcome.Response is null)
        {
            _logger.LogWarning(
                "[LlmMatching] UnifiedAi indisponível: {Reason} — {Detail}",
                outcome.Reason, outcome.Detail);
            return (null, effectiveModel);
        }

        var content = outcome.Response.Content?.Trim() ?? "";
        if (content.StartsWith("AI_ERROR:", StringComparison.OrdinalIgnoreCase))
        {
            var err = content.Length > "AI_ERROR:".Length
                ? content["AI_ERROR:".Length..].Trim()
                : "erro na API do provider";
            throw new LlmTimeoutException($"Falha ao chamar o modelo de IA: {err}");
        }

        return (content, effectiveModel);
    }

    // ── PROMPTS ─────────────────────────────────────────────────────────────

    private static readonly string SystemPromptTemplate = """
        Você é um avaliador sênior de RH que compara um CV contra uma descrição de cargo
        estruturada (template DNALIO) e produz uma pontuação quantitativa e textual.

        Responda APENAS em JSON válido, sem markdown, sem ```json. Schema exato:
        {
          "scoreFinal": 0-100,
          "justificativa": "2-4 frases em PT-BR explicando o score",
          "criterios": [
            {
              "nome": "Competência|Experiência|Formação|Localidade|Idioma|Conhecimento Técnico|Vivência Específica",
              "peso": <peso_da_vaga>,
              "score": 0-100,
              "pontosFortes": ["evidência 1", "evidência 2"],
              "gaps": ["lacuna 1", "lacuna 2"]
            }
          ],
          "pontosFortes": ["bullet 1", "bullet 2", "bullet 3"],
          "gaps": ["bullet 1", "bullet 2"]
        }

        REGRAS OBRIGATÓRIAS:
        1. scoreFinal = SOMA(peso_i * score_i) / 100 — verifique matematicamente antes de responder
        2. Avalie SOMENTE com base no CV fornecido — nunca fabrique experiência ou skill
        3. Considere paráfrases, sinônimos e experiência correlata (ex.: "SAP FI" satisfaz "ERP financeiro")
        4. Penalize requisitos OBRIGATÓRIOS faltando (reduz até 20 pts), exceto requisitos processuais
           (como "perfil alinhado com gestor") que ignore
        5. Nunca retorne scoreFinal > 100 nem < 0
        6. Use apenas os 7 critérios com peso > 0 (os outros omita do array)
        7. Justificativa em PT-BR, objetiva, sem emojis, máximo 400 chars
        """;

    private static (string system, string user) BuildPrompts(RHPortal.Api.Domain.Entities.Vaga vaga, Candidato cand, IReadOnlyList<string> competencias)
    {
        var sb = new StringBuilder();
        sb.AppendLine("## VAGA");
        sb.AppendLine($"- Título: {vaga.Titulo}");
        sb.AppendLine($"- Senioridade: {vaga.Senioridade?.ToString() ?? "n/a"}");
        sb.AppendLine($"- Modalidade: {vaga.Modalidade?.ToString() ?? "n/a"}");
        sb.AppendLine($"- Cidade: {vaga.Cidade ?? "n/a"}/{vaga.Uf ?? ""}");
        sb.AppendLine($"- Match mínimo: {vaga.MatchMinimoPercentual}%");
        sb.AppendLine();

        // Pesos calibrados
        sb.AppendLine("## PESOS (somam 100)");
        if (vaga.PesoCompetencia > 0) sb.AppendLine($"- Competência: {vaga.PesoCompetencia}");
        if (vaga.PesoExperiencia > 0) sb.AppendLine($"- Experiência: {vaga.PesoExperiencia}");
        if (vaga.PesoFormacao > 0) sb.AppendLine($"- Formação: {vaga.PesoFormacao}");
        if (vaga.PesoLocalidade > 0) sb.AppendLine($"- Localidade: {vaga.PesoLocalidade}");
        if (vaga.PesoIdioma > 0) sb.AppendLine($"- Idioma: {vaga.PesoIdioma}");
        if (vaga.PesoConhecimentoTecnico > 0) sb.AppendLine($"- Conhecimento Técnico: {vaga.PesoConhecimentoTecnico}");
        if (vaga.PesoVivenciaEspecifica > 0) sb.AppendLine($"- Vivência Específica: {vaga.PesoVivenciaEspecifica}");
        sb.AppendLine();

        // Descrição de cargo estruturada
        var dc = vaga.DescricaoCargo!;
        sb.AppendLine("## DESCRIÇÃO DO CARGO (template DNALIO)");
        if (!string.IsNullOrEmpty(dc.Summary)) sb.AppendLine($"**Sumário**: {dc.Summary}");
        sb.AppendLine($"**Formação Mínima**: {dc.FormacaoMinima ?? "n/a"}");
        sb.AppendLine($"**Formação Desejável**: {dc.FormacaoDesejavel ?? "n/a"}");
        sb.AppendLine($"**Área de Estudo**: {dc.FormacaoAreaEstudo ?? "n/a"}");
        sb.AppendLine($"**Experiência Mínima**: {dc.ExperienciaTempoMinimo ?? "n/a"}");
        sb.AppendLine($"**Exp. Especificação**: {dc.ExperienciaEspecificacao ?? "n/a"}");
        sb.AppendLine();

        // Agrupa itens por categoria
        var itensPorCategoria = dc.Itens.GroupBy(i => i.Categoria).OrderBy(g => (int)g.Key);
        foreach (var grp in itensPorCategoria)
        {
            sb.AppendLine($"### {CategoriaLabel(grp.Key)}");
            foreach (var item in grp.OrderBy(i => i.Ordem))
            {
                var subcat = string.IsNullOrEmpty(item.Subcategoria) ? "" : $" [{item.Subcategoria}]";
                var obrig = item.IsObrigatoria ? " **(obrigatório)**" : "";
                sb.AppendLine($"- {item.Texto}{subcat}{obrig}");
            }
            sb.AppendLine();
        }

        // CV do candidato
        sb.AppendLine("## CANDIDATO");
        sb.AppendLine($"- Nome: {cand.Nome}");
        sb.AppendLine($"- Cidade: {cand.Cidade ?? "n/a"}/{cand.Uf ?? ""}");
        sb.AppendLine();
        sb.AppendLine("### CV / Resumo");
        if (!string.IsNullOrEmpty(cand.CvText))
            sb.AppendLine(cand.CvText);
        else if (!string.IsNullOrEmpty(cand.ResumoProfissional))
            sb.AppendLine(cand.ResumoProfissional);
        else
            sb.AppendLine("(sem CV textual)");

        if (competencias.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("### Competências declaradas");
            foreach (var c in competencias) sb.AppendLine($"- {c}");
        }

        sb.AppendLine();
        sb.AppendLine("## TAREFA");
        sb.AppendLine("Avalie o candidato para esta vaga. Aplique os pesos. Retorne JSON no schema exato do system prompt.");

        return (SystemPromptTemplate, sb.ToString());
    }

    private static string CategoriaLabel(DescricaoCargoItemCategoria cat) => cat switch
    {
        DescricaoCargoItemCategoria.AtividadeEspecifica   => "Atividades Específicas",
        DescricaoCargoItemCategoria.AtividadeComum        => "Atividades Comuns",
        DescricaoCargoItemCategoria.VivenciaEspecifica    => "Vivências Específicas",
        DescricaoCargoItemCategoria.CompetenciaDnalio     => "Competências DNALIO",
        DescricaoCargoItemCategoria.CompetenciaLideranca  => "Competências de Liderança",
        DescricaoCargoItemCategoria.CompetenciaFuncional  => "Competências Funcionais",
        DescricaoCargoItemCategoria.CompetenciaTecnica    => "Competências Técnicas",
        DescricaoCargoItemCategoria.RequisitoObrigatorio  => "Requisitos Obrigatórios",
        _ => cat.ToString()
    };

    // ── HASH + CACHE + PARSE ────────────────────────────────────────────────

    private static string ComputeInputHash(RHPortal.Api.Domain.Entities.Vaga vaga, Candidato cand, IReadOnlyList<string> competencias)
    {
        var sb = new StringBuilder();
        sb.Append(cand.CvText ?? "").Append('|').Append(cand.ResumoProfissional ?? "").Append('|');
        sb.Append(string.Join(",", competencias)).Append('|');
        sb.Append(vaga.DescricaoCargoId).Append('|');
        foreach (var item in vaga.DescricaoCargo!.Itens.OrderBy(i => i.Id))
            sb.Append(item.Texto).Append(',').Append(item.Categoria).Append('|');
        sb.Append($"{vaga.PesoCompetencia}_{vaga.PesoExperiencia}_{vaga.PesoFormacao}_{vaga.PesoLocalidade}_{vaga.PesoIdioma}_{vaga.PesoConhecimentoTecnico}_{vaga.PesoVivenciaEspecifica}_{vaga.MatchMinimoPercentual}");

        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
        return Convert.ToHexString(bytes);
    }

    private async Task UpsertCacheAsync(
        string tenantId, Guid candidatoId, Guid vagaId,
        LlmPayload parsed, bool passou, string inputHash, string modelVersion, int durationMs, CancellationToken ct)
    {
        var existing = await _db.CandidatoVagaLlmScores
            .FirstOrDefaultAsync(x => x.VagaId == vagaId && x.CandidatoId == candidatoId, ct);

        var criteriosJson = JsonSerializer.Serialize(parsed.Criterios ?? new List<LlmPayloadCriterio>());
        var pontosFortes = string.Join("; ", parsed.PontosFortes ?? new List<string>());
        var gaps = string.Join("; ", parsed.Gaps ?? new List<string>());
        var now = DateTimeOffset.UtcNow;

        if (existing is null)
        {
            _db.CandidatoVagaLlmScores.Add(new CandidatoVagaLlmScore
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CandidatoId = candidatoId,
                VagaId = vagaId,
                ScoreFinal = parsed.ScoreFinal,
                PassouMatchMinimo = passou,
                JustificativaTexto = Truncate(parsed.Justificativa ?? "", 4000),
                CriteriosJson = criteriosJson,
                PontosFortes = Truncate(pontosFortes, 2000),
                Gaps = Truncate(gaps, 2000),
                InputHash = inputHash,
                ModelVersion = modelVersion,
                DurationMs = durationMs,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }
        else
        {
            existing.ScoreFinal = parsed.ScoreFinal;
            existing.PassouMatchMinimo = passou;
            existing.JustificativaTexto = Truncate(parsed.Justificativa ?? "", 4000);
            existing.CriteriosJson = criteriosJson;
            existing.PontosFortes = Truncate(pontosFortes, 2000);
            existing.Gaps = Truncate(gaps, 2000);
            existing.InputHash = inputHash;
            existing.ModelVersion = modelVersion;
            existing.DurationMs = durationMs;
            existing.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
    }

    private static LlmMatchingResult ResultFromEntity(CandidatoVagaLlmScore e, bool usouCache)
    {
        List<LlmCriterio> criterios = new();
        try
        {
            var raw = JsonSerializer.Deserialize<List<LlmPayloadCriterio>>(e.CriteriosJson) ?? new();
            criterios = raw.Select(c => new LlmCriterio(
                c.Nome ?? "", c.Peso, c.Score,
                (decimal)Math.Round(c.Peso * c.Score / 100.0, 1),
                c.PontosFortes ?? new List<string>(),
                c.Gaps ?? new List<string>()
            )).ToList();
        }
        catch { /* cache corrompido — continua sem breakdown */ }

        return new LlmMatchingResult(
            e.CandidatoId, e.VagaId,
            e.ScoreFinal, e.PassouMatchMinimo,
            e.JustificativaTexto,
            criterios,
            (e.PontosFortes ?? "").Split("; ", StringSplitOptions.RemoveEmptyEntries),
            (e.Gaps ?? "").Split("; ", StringSplitOptions.RemoveEmptyEntries),
            e.ModelVersion,
            e.DurationMs,
            UsouCache: usouCache);
    }

    private static LlmPayload? TryParseJson(string raw)
    {
        try
        {
            var cleaned = raw.Trim();
            if (cleaned.StartsWith("```"))
            {
                var nl = cleaned.IndexOf('\n');
                if (nl > 0) cleaned = cleaned.Substring(nl + 1);
                if (cleaned.EndsWith("```")) cleaned = cleaned.Substring(0, cleaned.Length - 3);
                cleaned = cleaned.Trim();
            }
            return JsonSerializer.Deserialize<LlmPayload>(cleaned, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
        }
        catch { return null; }
    }

    private static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) ? "" : (s.Length <= max ? s : s.Substring(0, max));

    // ── DTOs do JSON do LLM ────────────────────────────────────────────────
    private sealed class LlmPayload
    {
        [JsonPropertyName("scoreFinal")] public int ScoreFinal { get; set; }
        [JsonPropertyName("justificativa")] public string? Justificativa { get; set; }
        [JsonPropertyName("criterios")] public List<LlmPayloadCriterio>? Criterios { get; set; }
        [JsonPropertyName("pontosFortes")] public List<string>? PontosFortes { get; set; }
        [JsonPropertyName("gaps")] public List<string>? Gaps { get; set; }
    }

    private sealed class LlmPayloadCriterio
    {
        [JsonPropertyName("nome")] public string? Nome { get; set; }
        [JsonPropertyName("peso")] public int Peso { get; set; }
        [JsonPropertyName("score")] public int Score { get; set; }
        [JsonPropertyName("pontosFortes")] public List<string>? PontosFortes { get; set; }
        [JsonPropertyName("gaps")] public List<string>? Gaps { get; set; }
    }
}

/// <summary>
/// Exceção específica para quando o LLM demora demais / retorna vazio. O controller
/// captura e devolve 503 com mensagem acionável em vez de 500 genérico.
/// </summary>
public sealed class LlmTimeoutException : Exception
{
    public LlmTimeoutException(string message) : base(message) { }
}
