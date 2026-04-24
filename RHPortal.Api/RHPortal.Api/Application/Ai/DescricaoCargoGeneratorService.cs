using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.DescricaoCargo;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Ai;

/// <summary>
/// Gerador de templates DNALIO via LLM. Dado um brief (título + contexto), produz
/// um <see cref="DescricaoCargoCreateRequest"/> completo com as 8 categorias DNALIO
/// populadas e formação/experiência inferidas.
///
/// <para>Usa Qwen 2.5 com prompt few-shot que inclui um exemplo real do padrão
/// Liotécnica (Assistente de Suporte Técnico) + instrução JSON-only. Temperatura
/// 0.2 para output determinístico-ish.</para>
/// </summary>
public sealed class DescricaoCargoGeneratorService : IDescricaoCargoGeneratorService
{
    private readonly IOllamaClient _ollama;
    private readonly ILogger<DescricaoCargoGeneratorService> _logger;

    public DescricaoCargoGeneratorService(IOllamaClient ollama, ILogger<DescricaoCargoGeneratorService> logger)
    {
        _ollama = ollama;
        _logger = logger;
    }

    public async Task<DescricaoCargoGenerationResult> GenerateAsync(
        string titulo,
        string? contextoAdicional = null,
        string? areaOuDepto = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(titulo))
            return new DescricaoCargoGenerationResult(false, null, null, "Título é obrigatório.");

        var userPrompt = BuildUserPrompt(titulo, areaOuDepto, contextoAdicional);
        var messages = new List<OllamaChatMessage>
        {
            new("user", userPrompt)
        };

        var resp = await _ollama.ChatAsync(
            messages,
            new OllamaChatOptions(Temperature: 0.2, SystemPrompt: SystemPrompt, MaxTokens: 4096),
            ct);

        if (!resp.IsSuccess || string.IsNullOrWhiteSpace(resp.Content))
        {
            return new DescricaoCargoGenerationResult(false, null, resp.Content, resp.ErrorMessage ?? "Resposta vazia.");
        }

        var request = TryParseJson(resp.Content, titulo, areaOuDepto);
        if (request is null)
        {
            return new DescricaoCargoGenerationResult(false, null, resp.Content, "Não foi possível parsear JSON retornado pelo LLM.");
        }

        return new DescricaoCargoGenerationResult(true, request, resp.Content, null);
    }

    private const string SystemPrompt = """
        Você é um especialista em descrição de cargos para a Liotécnica (indústria de alimentos).
        Sua tarefa é gerar um template DNALIO estruturado seguindo EXATAMENTE o schema JSON abaixo.

        Retorne APENAS um JSON válido (nada de texto antes/depois, sem markdown ```json).

        Schema:
        {
          "Code": "CODE-CURTO-SEM-ESPACO",    // uppercase, hífen, max 30 chars
          "Title": "Título completo do cargo",
          "AreaTemplate": "Área do cargo",
          "Summary": "Descrição sumária em 2-3 frases",
          "FormacaoMinima": "Ensino superior completo / Técnico / etc",
          "FormacaoDesejavel": "Pós-graduação / MBA / etc (opcional)",
          "FormacaoAreaEstudo": "Área de formação",
          "ExperienciaTempoMinimo": "1 ano / 2 anos / 5 anos / etc",
          "ExperienciaTempoDesejavel": "opcional",
          "ExperienciaEspecificacao": "Contexto da experiência",
          "Itens": [
            { "Categoria": 1,  "Texto": "atividade específica 1", "IsObrigatoria": true,  "Subcategoria": null, "Ordem": 0 },
            { "Categoria": 2,  "Texto": "atividade comum do nível", "IsObrigatoria": false, "Subcategoria": null, "Ordem": 0 },
            { "Categoria": 3,  "Texto": "vivência específica", "IsObrigatoria": true, "Subcategoria": null, "Ordem": 0 },
            { "Categoria": 10, "Texto": "Prioridade ao Cliente", "IsObrigatoria": false, "Subcategoria": null, "Ordem": 0 },
            { "Categoria": 11, "Texto": "Trabalho em Equipe", "IsObrigatoria": false, "Subcategoria": null, "Ordem": 0 },
            { "Categoria": 12, "Texto": "Organização", "IsObrigatoria": false, "Subcategoria": null, "Ordem": 0 },
            { "Categoria": 13, "Texto": "Hardware", "IsObrigatoria": false, "Subcategoria": "Hardware", "Ordem": 0 },
            { "Categoria": 20, "Texto": "Requisito obrigatório", "IsObrigatoria": true, "Subcategoria": null, "Ordem": 0 }
          ]
        }

        Categorias:
          1 = AtividadeEspecifica (técnicas do dia-a-dia do cargo — 6 a 10 itens)
          2 = AtividadeComum (alinhadas com missão/valores — 5 a 7 itens)
          3 = VivenciaEspecifica (experiências esperadas — 2 a 4 itens)
         10 = CompetenciaDnalio (SOMENTE estas: "Prioridade ao Cliente", "Alta Performance", "Foco em Resultados", "Responsabilidade Social e Ambiental", "Senso de Justiça com Respeito e Ética")
         11 = CompetenciaLideranca (ex.: "Trabalho em Equipe")
         12 = CompetenciaFuncional (ex.: "Administração do Tempo", "Organização", "Dinamismo" — 3 a 5 itens)
         13 = CompetenciaTecnica (hardware/software/idiomas/segurança — usar Subcategoria "Hardware"/"Software"/"Idioma"/"Segurança"; 3 a 6 itens)
         20 = RequisitoObrigatorio (linha de corte do recrutamento; 3 a 5 itens)

        REGRAS:
          - Sempre use as 5 competências DNALIO fixas na categoria 10.
          - Nunca fabrique dados empresariais específicos (ex.: nomes de softwares proprietários não mencionados no contexto).
          - Texto de itens deve ser uma frase completa, em 3ª pessoa do verbo no infinitivo ou substantivo. Max 500 chars.
          - Code deve ser o título em uppercase com hífens (ex.: "ANALISTA-FINANCEIRO-JR").
        """;

    private static string BuildUserPrompt(string titulo, string? area, string? contexto)
    {
        var sb = new StringBuilder();
        sb.Append("Gere um template DNALIO para o cargo: \"").Append(titulo).Append("\".");
        if (!string.IsNullOrWhiteSpace(area))
            sb.Append(" Área/Departamento: ").Append(area).Append('.');
        if (!string.IsNullOrWhiteSpace(contexto))
            sb.Append("\nContexto adicional: ").Append(contexto);
        sb.AppendLine();
        sb.AppendLine("Retorne apenas o JSON no formato do schema.");
        return sb.ToString();
    }

    /// <summary>
    /// Tenta parsear o JSON retornado pelo LLM. Se vier com markdown fences, remove.
    /// Valida campos mínimos e retorna <see cref="DescricaoCargoCreateRequest"/> pronto.
    /// </summary>
    private DescricaoCargoCreateRequest? TryParseJson(string raw, string fallbackTitulo, string? fallbackArea)
    {
        var cleaned = StripMarkdownFences(raw).Trim();

        try
        {
            var parsed = JsonSerializer.Deserialize<LlmDescricaoCargoPayload>(cleaned, JsonOpts);
            if (parsed is null) return null;

            var code = !string.IsNullOrWhiteSpace(parsed.Code)
                ? parsed.Code
                : SanitizeCode(parsed.Title ?? fallbackTitulo);

            var itens = (parsed.Itens ?? new())
                .Select((i, idx) => new DescricaoCargoItemRequest(
                    Categoria: (DescricaoCargoItemCategoria)i.Categoria,
                    Texto: Truncate(i.Texto ?? "", 500),
                    IsObrigatoria: i.IsObrigatoria,
                    NivelMinimo: Truncate(i.NivelMinimo, 40),
                    Subcategoria: Truncate(i.Subcategoria, 80),
                    Ordem: i.Ordem != 0 ? i.Ordem : idx))
                .Where(x => !string.IsNullOrWhiteSpace(x.Texto))
                .ToList();

            return new DescricaoCargoCreateRequest(
                Code: Truncate(code, 30)!,
                Title: Truncate(parsed.Title, 200) ?? fallbackTitulo,
                AreaTemplate: Truncate(parsed.AreaTemplate, 120) ?? fallbackArea,
                CboCodigo: Truncate(parsed.CboCodigo, 20),
                Summary: Truncate(parsed.Summary, 2000),
                FormacaoMinima: Truncate(parsed.FormacaoMinima, 200),
                FormacaoDesejavel: Truncate(parsed.FormacaoDesejavel, 200),
                FormacaoAreaEstudo: Truncate(parsed.FormacaoAreaEstudo, 200),
                ExperienciaTempoMinimo: Truncate(parsed.ExperienciaTempoMinimo, 80),
                ExperienciaTempoDesejavel: Truncate(parsed.ExperienciaTempoDesejavel, 80),
                ExperienciaEspecificacao: Truncate(parsed.ExperienciaEspecificacao, 500),
                RevisaoNumero: "00",
                RevisaoData: DateOnly.FromDateTime(DateTime.UtcNow),
                RevisaoNatureza: "Gerada por IA",
                GestorNome: null,
                GestorEmail: null,
                Responsibilities: null,
                Requirements: null,
                NiceToHave: null,
                Benefits: null,
                Itens: itens,
                IsTemplate: true,
                IsActive: true,
                NivelCargoId: null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao parsear JSON do LLM. Content:\n{Content}", cleaned);
            return null;
        }
    }

    private static string StripMarkdownFences(string s)
    {
        var trim = s.Trim();
        if (trim.StartsWith("```"))
        {
            var firstNewline = trim.IndexOf('\n');
            if (firstNewline > 0) trim = trim.Substring(firstNewline + 1);
            if (trim.EndsWith("```")) trim = trim.Substring(0, trim.Length - 3);
        }
        return trim;
    }

    private static string SanitizeCode(string title)
    {
        var upper = (title ?? "").ToUpperInvariant();
        var sb = new StringBuilder();
        foreach (var c in upper)
        {
            if (char.IsLetterOrDigit(c)) sb.Append(c);
            else if (c == ' ' || c == '-' || c == '_') sb.Append('-');
        }
        var collapsed = System.Text.RegularExpressions.Regex.Replace(sb.ToString(), "-+", "-").Trim('-');
        return collapsed.Length > 30 ? collapsed.Substring(0, 30).TrimEnd('-') : collapsed;
    }

    private static string? Truncate(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return s;
        return s.Length <= max ? s : s.Substring(0, max);
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    // Payload do LLM — permissive sobre tipos (LLM pode enviar strings vazias ou null)
    private sealed class LlmDescricaoCargoPayload
    {
        public string? Code { get; set; }
        public string? Title { get; set; }
        public string? AreaTemplate { get; set; }
        public string? CboCodigo { get; set; }
        public string? Summary { get; set; }
        public string? FormacaoMinima { get; set; }
        public string? FormacaoDesejavel { get; set; }
        public string? FormacaoAreaEstudo { get; set; }
        public string? ExperienciaTempoMinimo { get; set; }
        public string? ExperienciaTempoDesejavel { get; set; }
        public string? ExperienciaEspecificacao { get; set; }
        public List<LlmItemPayload>? Itens { get; set; }
    }
    private sealed class LlmItemPayload
    {
        public int Categoria { get; set; }
        public string? Texto { get; set; }
        public bool IsObrigatoria { get; set; }
        public string? NivelMinimo { get; set; }
        public string? Subcategoria { get; set; }
        public int Ordem { get; set; }
    }
}
