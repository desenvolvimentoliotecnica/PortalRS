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
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Implementação do LLM-as-a-Judge: monta prompt estruturado com DescCargo DNALIO
/// + CV + pesos, chama Qwen 2.5 via <see cref="IOllamaClient"/> em modo JSON,
/// parseia resposta e persiste em <see cref="CandidatoVagaLlmScore"/>.
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
    private readonly OllamaOptions _ollamaOptions;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<LlmMatchingService> _logger;

    public LlmMatchingService(
        AppDbContext db,
        IOllamaClient ollama,
        IOptions<AiOptions> aiOptions,
        ITenantContext tenantContext,
        ILogger<LlmMatchingService> logger)
    {
        _db = db;
        _ollama = ollama;
        _ollamaOptions = aiOptions.Value.Ollama;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    public async Task<LlmMatchingResult?> ScoreAsync(Guid candidatoId, Guid vagaId, bool force = false, CancellationToken ct = default)
    {
        var tenantId = _tenantContext.TenantId ?? "";

        // ── 1. Carrega contexto ─────────────────────────────────────────────
        var vaga = await _db.Vagas
            .AsNoTracking()
            .Include(v => v.DescricaoCargo)
                .ThenInclude(d => d!.Itens)
            .FirstOrDefaultAsync(v => v.Id == vagaId, ct);

        if (vaga is null) return null;
        if (vaga.DescricaoCargo is null) return null;

        var candidato = await _db.Candidatos
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == candidatoId, ct);
        if (candidato is null) return null;

        var competencias = await _db.CandidatoCompetencias
            .AsNoTracking()
            .Where(x => x.CandidatoId == candidatoId)
            .Select(x => x.Nome)
            .ToListAsync(ct);

        // ── 2. Hash do input (CV + DescCargo itens + pesos + MatchMinimo) ──
        var inputHash = ComputeInputHash(vaga, candidato, competencias);

        // ── 3. Cache check ──────────────────────────────────────────────────
        if (!force)
        {
            var cached = await _db.CandidatoVagaLlmScores
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.VagaId == vagaId && x.CandidatoId == candidatoId, ct);
            if (cached is not null
                && cached.InputHash == inputHash
                && cached.ModelVersion == _ollamaOptions.ChatModel)
            {
                _logger.LogDebug("[LlmMatching] Cache hit para cand={Cand} vaga={Vaga}", candidatoId, vagaId);
                return ResultFromEntity(cached, usouCache: true);
            }
        }

        // ── 4. Health check do Ollama ───────────────────────────────────────
        var health = await _ollama.CheckHealthAsync(ct);
        if (!health.IsReachable || !health.HasChatModel)
        {
            _logger.LogInformation("[LlmMatching] Ollama indisponível — score LLM não computado. {Err}", health.ErrorMessage);
            return null;
        }

        // ── 5. Monta prompt ────────────────────────────────────────────────
        var (systemPrompt, userPrompt) = BuildPrompts(vaga, candidato, competencias);

        // ── 6. Chama Qwen ──────────────────────────────────────────────────
        var sw = Stopwatch.StartNew();
        var messages = new List<OllamaChatMessage> { new("user", userPrompt) };
        var resp = await _ollama.ChatAsync(messages,
            new OllamaChatOptions(
                Temperature: 0.1,
                SystemPrompt: systemPrompt,
                MaxTokens: 2000),
            ct);
        sw.Stop();

        if (!resp.IsSuccess || string.IsNullOrWhiteSpace(resp.Content))
        {
            _logger.LogWarning("[LlmMatching] Qwen retornou vazio após {Elapsed}ms. {Err}",
                sw.ElapsedMilliseconds, resp.ErrorMessage);
            // Retorna resultado indicando timeout/falha para o controller diferenciar de "ollama off"
            throw new LlmTimeoutException(
                $"Qwen não respondeu em {sw.ElapsedMilliseconds / 1000}s. " +
                $"Isso pode indicar: (1) modelo descarregado da memória (cold start), " +
                $"(2) GPU indisponível forçando CPU lenta, (3) prompt muito grande. " +
                $"Tente novamente — a 2ª chamada costuma ser rápida com modelo já quente.");
        }

        var parsed = TryParseJson(resp.Content);
        if (parsed is null)
        {
            _logger.LogWarning("[LlmMatching] JSON inválido do LLM (len={Len}):\n{Content}",
                resp.Content?.Length ?? 0, resp.Content);
            throw new LlmTimeoutException("Qwen retornou resposta em formato inesperado. Tente regenerar.");
        }

        // ── 7. Valida pesos e normaliza score final ─────────────────────────
        var matchMin = Math.Clamp(vaga.MatchMinimoPercentual, 0, 100);
        var passou = parsed.ScoreFinal >= matchMin;

        // ── 8. Persiste no cache ───────────────────────────────────────────
        await UpsertCacheAsync(tenantId, candidatoId, vagaId, parsed, passou, inputHash, (int)sw.ElapsedMilliseconds, ct);

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
            _ollamaOptions.ChatModel,
            (int)sw.ElapsedMilliseconds,
            UsouCache: false);
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
        LlmPayload parsed, bool passou, string inputHash, int durationMs, CancellationToken ct)
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
                ModelVersion = _ollamaOptions.ChatModel,
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
            existing.ModelVersion = _ollamaOptions.ChatModel;
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
