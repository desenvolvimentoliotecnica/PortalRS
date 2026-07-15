using System.Text.Json;
using System.Text.RegularExpressions;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Contracts.Talentos;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Talentos;

public sealed class CvGptExtractor : ICvGptExtractor
{
    private const string ModuleName = "CvExtract";
    private const int MaxCvLength = 30000;

    private readonly IUnifiedAiService _aiService;
    private readonly ITenantContext _tenantContext;

    private static readonly string SystemPrompt = """
        Você é um assistente que extrai dados estruturados de currículos.
        Analise o texto do currículo abaixo e responda APENAS com um único objeto JSON válido, sem markdown e sem texto adicional, no seguinte formato:
        {
          "nome": "string ou null",
          "email": "string ou null",
          "fone": "string ou null",
          "cidade": "string ou null",
          "uf": "string ou null",
          "linkedinUrl": "string ou null",
          "resumoProfissional": "string ou null",
          "cpf": "string ou null",
          "dataNascimento": "string ou null (data de nascimento em ISO 8601 YYYY-MM-DD ou DD/MM/AAAA)",
          "cep": "string ou null",
          "logradouro": "string ou null",
          "numero": "string ou null",
          "bairro": "string ou null",
          "endereco": "string ou null (endereço completo em uma linha quando não estiver separado em campos acima)",
          "competencias": [ { "tipo": "string", "nome": "string", "nivel": "string", "evidencia": "string ou null", "tempoAtuacao": "string ou null" } ],
          "experiencias": [ { "empresa": "string", "cargo": "string", "inicio": "string ou null", "fim": "string ou null", "tipoContratacao": "string ou null (ex: CLT, PJ, Estagio, Freelance)", "local": "string ou null", "atividades": "string ou null - TEXTO EXATO das atividades como no currículo, sem resumir, preservando bullets e redação original", "resumoAtividades": "string ou null (resumo em poucas linhas)", "nivelSenioridade": "string ou null (ex: Estagiario, JR, Pleno, Senior, Especialista)", "nivelHierarquico": "string ou null (ex: Analista, Coordenador, Gerente, Diretor)" } ],
          "treinamentos": [ { "nome": "string", "instituicao": "string ou null", "ano": "string ou null", "link": "string ou null" } ],
          "formacao": [ { "curso": "string", "instituicao": "string ou null", "tipo": "string ou null", "status": "string ou null", "inicio": "string ou null", "fim": "string ou null", "observacoes": "string ou null", "link": "string ou null" } ]
        }
        Use arrays vazios [] quando não houver dados. Extraia o máximo de informações possível do texto.
        OBRIGATÓRIO para "competencias": extraia TODAS as habilidades, competências técnicas e comportamentais, ferramentas, tecnologias, idiomas e conhecimentos mencionados no currículo (em resumo, seções de habilidades, experiências e formação). Cada item: "tipo" (ex: "Técnica", "Comportamental", "Idioma", "Ferramenta"), "nome" (nome da habilidade/tecnologia/idioma), "nivel" (ex: "Básico", "Intermediário", "Avançado", "Fluente", "Avançado"), "evidencia" (opcional, breve contexto), "tempoAtuacao" (opcional: quando o currículo indicar tempo de uso ou experiência na habilidade, ex.: "Java – 5 anos", "Excel – 3 anos de experiência", preencha com texto curto como "5 anos", "3 anos"). Não deixe "competencias" vazio se o currículo citar qualquer habilidade, tecnologia ou idioma.
        Extraia sempre a data de nascimento quando aparecer no currículo (ex: "Nascimento: 15/03/1990" ou "Data de Nascimento: 1990-03-15").
        Extraia o endereço completo em "endereco" quando estiver em uma só linha; quando estiver separado, preencha cep, logradouro, numero e bairro.
        Para cada experiência, em "atividades" copie EXATAMENTE o texto que descreve as atividades no currículo (verbatim, sem resumir). Em "resumoAtividades" coloque um resumo em poucas linhas.
        """;

    public CvGptExtractor(IUnifiedAiService aiService, ITenantContext tenantContext)
    {
        _aiService = aiService;
        _tenantContext = tenantContext;
    }

    public async Task<TalentoImportPdfSuggestedData?> ExtractSuggestedDataAsync(string cvText, CancellationToken ct)
    {
        var result = await ExtractWithDiagnosticsAsync(cvText, ct);
        return result.Data;
    }

    public async Task<CvGptExtractResult> ExtractWithDiagnosticsAsync(string cvText, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cvText))
            return new CvGptExtractResult(null, null, "CV sem texto extraível.");

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return new CvGptExtractResult(null, null, "Tenant não identificado.");

        var truncated = cvText.Length > MaxCvLength ? cvText.Substring(0, MaxCvLength) + "..." : cvText;
        var userMessage =
            "Extraia os dados do currículo abaixo. Responda APENAS com um único objeto JSON válido " +
            "(sem markdown, sem título, sem explicação), no formato do system prompt.\n\n" +
            "--- CURRÍCULO ---\n" +
            truncated;

        var request = new AiInvokeRequest(
            Module: ModuleName,
            ActionDescription: "Extrair dados do currículo",
            RequestMessage: "Extrair dados estruturados do currículo (JSON).",
            ModelId: null,
            Payload: new { prompt = SystemPrompt, cvText = userMessage });

        var response = await _aiService.InvokeAsync(tenantId, null, null, request, ct);
        if (response is null || string.IsNullOrWhiteSpace(response.Content))
            return new CvGptExtractResult(null, response?.Content, "IA não retornou conteúdo.");

        var raw = response.Content.Trim();
        if (raw.StartsWith("AI_ERROR:", StringComparison.OrdinalIgnoreCase))
            return new CvGptExtractResult(null, raw, raw);

        var data = ParseResponse(raw);
        if (data is null)
            return new CvGptExtractResult(null, raw, "Não foi possível interpretar o JSON retornado pela IA.");

        return new CvGptExtractResult(data, raw, null);
    }

    private static readonly string NovoCandidatoSystemPrompt = """
        Você é um assistente de RH que extrai dados de currículos para pré-preencher o cadastro de candidato.
        Responda APENAS com um único objeto JSON válido, sem markdown e sem texto fora do JSON, no formato:
        {
          "nome": "string ou null — nome completo da pessoa",
          "email": "string ou null — apenas o e-mail, sem texto colado",
          "fone": "string ou null — telefone fixo se houver",
          "celular": "string ou null — celular/WhatsApp",
          "cidade": "string ou null",
          "uf": "string ou null — 2 letras (ex: SP)",
          "linkedinUrl": "string ou null",
          "pretensaoSalarial": "number ou null — valor numérico em reais sem R$",
          "trabalhandoAtualmente": "boolean ou null",
          "observacoes": "string — texto em português, linguagem natural, 2 a 4 parágrafos: (1) resumo do perfil, trajetória e experiências; (2) conhecimentos, hard-skills e soft-skills; (3) avaliação objetiva do fit do candidato para a vaga informada (ou orientação geral se não houver vaga).",
          "termometro": "string — exatamente um de: baixo | parcial | adequado | bom | excelente",
          "termometroMotivo": "string — 1 frase curta em português justificando o grau do termômetro"
        }
        Regras:
        - Extraia o máximo possível do texto do currículo.
        - Em "email", nunca concatene palavras seguintes (ex.: após .com/.com.br).
        - Em "observacoes", seja concreto e útil para o analista de RH; não invente fatos que não estejam no CV; se a vaga estiver descrita, compare exigências vs perfil.
        - Em "termometro", escolha o grau de aderência do perfil à vaga (ou perfil geral se não houver vaga): baixo=não atende requisitos críticos; parcial=atende pouco com gaps relevantes; adequado=base compatível com ressalvas; bom=alinhado na maioria; excelente=alta aderência para priorizar.
        - Em "termometroMotivo", uma frase objetiva; não invente requisitos inexistentes.
        - Use null quando o dado não existir no texto.
        """;

    public async Task<CvNovoCandidatoExtractResult> ExtractForNovoCandidatoAsync(
        string cvText,
        string? vagaTitulo,
        string? vagaContexto,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cvText))
            return new CvNovoCandidatoExtractResult(null, null, "CV sem texto extraível.");

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
            return new CvNovoCandidatoExtractResult(null, null, "Tenant não identificado.");

        var truncated = cvText.Length > MaxCvLength ? cvText.Substring(0, MaxCvLength) + "..." : cvText;
        var vagaBlock = string.IsNullOrWhiteSpace(vagaTitulo) && string.IsNullOrWhiteSpace(vagaContexto)
            ? "Vaga: (não informada — faça avaliação de perfil genérica em observacoes)."
            : $"Vaga alvo: {vagaTitulo ?? "(sem título)"}\nContexto da vaga:\n{(string.IsNullOrWhiteSpace(vagaContexto) ? "(sem descrição adicional)" : vagaContexto.Trim())}";

        var userMessage =
            "Preencha o JSON do cadastro Novo Candidato com base no currículo e na vaga abaixo.\n" +
            "Responda APENAS com o JSON.\n\n" +
            $"--- {vagaBlock} ---\n\n" +
            "--- CURRÍCULO ---\n" +
            truncated;

        var request = new AiInvokeRequest(
            Module: ModuleName,
            ActionDescription: "Extrair dados do currículo (Novo Candidato)",
            RequestMessage: "Extrair campos do cadastro e observações (JSON).",
            ModelId: null,
            Payload: new { prompt = NovoCandidatoSystemPrompt, cvText = userMessage });

        var response = await _aiService.InvokeAsync(tenantId, null, null, request, ct);
        if (response is null || string.IsNullOrWhiteSpace(response.Content))
            return new CvNovoCandidatoExtractResult(null, response?.Content, "IA não retornou conteúdo.");

        var raw = response.Content.Trim();
        if (raw.StartsWith("AI_ERROR:", StringComparison.OrdinalIgnoreCase))
            return new CvNovoCandidatoExtractResult(null, raw, raw);

        var data = ParseNovoCandidatoResponse(raw);
        if (data is null)
            return new CvNovoCandidatoExtractResult(null, raw, "Não foi possível interpretar o JSON retornado pela IA.");

        // Sucesso mínimo: contato ou observações utilizáveis
        if (string.IsNullOrWhiteSpace(data.Nome)
            && string.IsNullOrWhiteSpace(data.Email)
            && string.IsNullOrWhiteSpace(data.Celular)
            && string.IsNullOrWhiteSpace(data.Fone)
            && string.IsNullOrWhiteSpace(data.Observacoes))
        {
            return new CvNovoCandidatoExtractResult(null, raw, "A IA não retornou dados utilizáveis do currículo.");
        }

        return new CvNovoCandidatoExtractResult(data, raw, null);
    }

    private static CvNovoCandidatoAiData? ParseNovoCandidatoResponse(string content)
    {
        try
        {
            var json = content.Trim();
            json = StripMarkdownJsonBlock(json);
            var start = json.IndexOf('{');
            var end = json.LastIndexOf('}');
            if (start >= 0 && end > start)
                json = json.Substring(start, end - start + 1);

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var email = Application.Candidatos.CvHeuristicExtractor.TrimEmailAtKnownTld(GetString(root, "email"));
            var uf = GetString(root, "uf");
            if (uf is { Length: > 2 })
                uf = uf.Trim()[..2];

            return new CvNovoCandidatoAiData(
                Nome: TrimToNull(GetString(root, "nome")),
                Email: email,
                Fone: TrimToNull(GetString(root, "fone")),
                Celular: TrimToNull(GetString(root, "celular")) ?? TrimToNull(GetString(root, "fone")),
                Cidade: TrimToNull(GetString(root, "cidade")),
                Uf: TrimToNull(uf)?.ToUpperInvariant(),
                LinkedinUrl: TrimToNull(GetString(root, "linkedinUrl")),
                PretensaoSalarial: GetDecimal(root, "pretensaoSalarial"),
                TrabalhandoAtualmente: GetBool(root, "trabalhandoAtualmente"),
                Observacoes: TrimToNull(GetString(root, "observacoes")),
                Termometro: NormalizeTermometro(GetString(root, "termometro")),
                TermometroMotivo: TrimToNull(GetString(root, "termometroMotivo")));
        }
        catch
        {
            return null;
        }
    }

    private static string? NormalizeTermometro(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var v = raw.Trim().ToLowerInvariant();
        return v switch
        {
            "baixo" or "1" or "frio" => "baixo",
            "parcial" or "2" or "morno" => "parcial",
            "adequado" or "3" or "neutro" => "adequado",
            "bom" or "4" or "quente" => "bom",
            "excelente" or "5" or "prioridade" or "emalta" or "em alta" => "excelente",
            _ => null
        };
    }

    private static decimal? GetDecimal(JsonElement e, string name)
    {
        if (!TryGetPropertyIgnoreCase(e, name, out var p)) return null;
        if (p.ValueKind == JsonValueKind.Number && p.TryGetDecimal(out var d)) return d;
        if (p.ValueKind == JsonValueKind.String
            && decimal.TryParse(p.GetString()?.Replace("R$", "").Replace(".", "").Replace(",", ".").Trim(),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var parsed))
            return parsed;
        return null;
    }

    private static bool? GetBool(JsonElement e, string name)
    {
        if (!TryGetPropertyIgnoreCase(e, name, out var p)) return null;
        if (p.ValueKind is JsonValueKind.True) return true;
        if (p.ValueKind is JsonValueKind.False) return false;
        if (p.ValueKind == JsonValueKind.String
            && bool.TryParse(p.GetString(), out var b))
            return b;
        return null;
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement e, string name, out JsonElement value)
    {
        if (e.TryGetProperty(name, out value)) return true;
        foreach (var prop in e.EnumerateObject())
        {
            if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = prop.Value;
                return true;
            }
        }
        value = default;
        return false;
    }

    private static TalentoImportPdfSuggestedData? ParseResponse(string content)
    {
        try
        {
            var json = content.Trim();
            json = StripMarkdownJsonBlock(json);
            var start = json.IndexOf('{');
            var end = json.LastIndexOf('}');
            if (start >= 0 && end > start)
                json = json.Substring(start, end - start + 1);

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var nome = GetString(root, "nome");
            var email = GetString(root, "email");
            var fone = GetString(root, "fone");
            var cidade = GetString(root, "cidade");
            var uf = GetString(root, "uf");
            var linkedinUrl = GetString(root, "linkedinUrl");
            var resumoProfissional = GetString(root, "resumoProfissional");
            var cpf = GetString(root, "cpf");
            var cep = GetString(root, "cep");
            var logradouro = GetString(root, "logradouro");
            var numero = GetString(root, "numero");
            var bairro = GetString(root, "bairro");
            var dataNascimento = ParseDataNascimento(GetString(root, "dataNascimento"));
            var endereco = GetString(root, "endereco");

            var competenciasRaw = ParseArray(root, "competencias", e => new TalentoCompetenciaItem(
                null,
                GetString(e, "tipo") ?? "",
                GetString(e, "nome") ?? "",
                GetString(e, "nivel") ?? "",
                GetString(e, "evidencia"),
                GetString(e, "tempoAtuacao")));
            if (competenciasRaw.Count == 0 && root.TryGetProperty("habilidades", out var habilidadesEl) && habilidadesEl.ValueKind == JsonValueKind.Array)
            {
                competenciasRaw = ParseArray(root, "habilidades", e => new TalentoCompetenciaItem(
                    null,
                    GetString(e, "tipo") ?? "",
                    GetString(e, "nome") ?? "",
                    GetString(e, "nivel") ?? "",
                    GetString(e, "evidencia"),
                    GetString(e, "tempoAtuacao")));
            }
            var competencias = competenciasRaw
                .Where(c => !string.IsNullOrWhiteSpace(c.Tipo) || !string.IsNullOrWhiteSpace(c.Nome) || !string.IsNullOrWhiteSpace(c.Nivel))
                .ToList();

            var experienciasRaw = ParseArray(root, "experiencias", e => new TalentoExperienciaItem(
                null,
                GetString(e, "empresa") ?? "",
                GetString(e, "cargo") ?? "",
                GetString(e, "inicio"),
                GetString(e, "fim"),
                GetString(e, "tipoContratacao"),
                GetString(e, "local"),
                GetString(e, "atividades"),
                TrimToNull(GetString(e, "resumoAtividades")),
                TrimToNull(GetString(e, "nivelSenioridade")),
                TrimToNull(GetString(e, "nivelHierarquico"))));
            var experiencias = experienciasRaw
                .Where(e => !string.IsNullOrWhiteSpace(e.Empresa) || !string.IsNullOrWhiteSpace(e.Cargo))
                .ToList();

            var treinamentosRaw = ParseArray(root, "treinamentos", e => new TalentoTreinamentoItem(
                null,
                GetString(e, "nome") ?? "",
                GetString(e, "instituicao"),
                GetString(e, "ano"),
                GetString(e, "link")));
            var treinamentos = treinamentosRaw
                .Where(t => !string.IsNullOrWhiteSpace(t.Nome))
                .ToList();

            var formacaoRaw = ParseArray(root, "formacao", e => new TalentoFormacaoItem(
                null,
                GetString(e, "curso") ?? "",
                GetString(e, "instituicao"),
                GetString(e, "tipo"),
                GetString(e, "status"),
                GetString(e, "inicio"),
                GetString(e, "fim"),
                GetString(e, "observacoes"),
                GetString(e, "link")));
            var formacao = formacaoRaw
                .Where(f => !string.IsNullOrWhiteSpace(f.Curso))
                .ToList();

            return new TalentoImportPdfSuggestedData(
                nome,
                email,
                fone,
                cidade,
                uf,
                linkedinUrl,
                resumoProfissional,
                cpf,
                cep,
                logradouro,
                numero,
                bairro,
                dataNascimento,
                endereco,
                competencias,
                experiencias,
                treinamentos,
                formacao);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Removes markdown code block wrapper (e.g. ```json ... ``` or ``` ... ```) so the inner JSON can be parsed.</summary>
    private static string StripMarkdownJsonBlock(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return content;
        var s = content.Trim();
        var jsonBlock = Regex.Match(s, @"^\s*```(?:json)?\s*\r?\n?(.*)\r?\n?\s*```\s*$", RegexOptions.Singleline);
        if (jsonBlock.Success && jsonBlock.Groups.Count > 1)
            return jsonBlock.Groups[1].Value.Trim();
        return s;
    }

    private static string? GetString(JsonElement e, string name)
    {
        if (e.TryGetProperty(name, out var p))
            return p.ValueKind == JsonValueKind.String ? p.GetString() : p.ToString();

        // Alguns modelos devolvem PascalCase (Nome, Email…).
        foreach (var prop in e.EnumerateObject())
        {
            if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                return prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.ToString();
        }

        return null;
    }

    private static string? TrimToNull(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>Parses date string (YYYY-MM-DD or DD/MM/YYYY) to DateTime? (date only, UTC noon).</summary>
    private static DateTime? ParseDataNascimento(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var s = value.Trim();
        if (DateTime.TryParseExact(s, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var iso))
            return DateTime.SpecifyKind(iso, DateTimeKind.Utc);
        if (DateTime.TryParseExact(s, "dd/MM/yyyy", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var br))
            return DateTime.SpecifyKind(br, DateTimeKind.Utc);
        if (DateTime.TryParse(s, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var any))
            return DateTime.SpecifyKind(DateTime.SpecifyKind(any, DateTimeKind.Unspecified).Date, DateTimeKind.Utc);
        return null;
    }

    private static IReadOnlyList<T> ParseArray<T>(JsonElement root, string name, Func<JsonElement, T> map)
    {
        if (!root.TryGetProperty(name, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return Array.Empty<T>();
        var list = new List<T>();
        foreach (var item in arr.EnumerateArray())
            list.Add(map(item));
        return list;
    }
}
