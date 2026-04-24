using System.Globalization;
using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using RhPortal.Api.Contracts.DescricaoCargo;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.DescricaoCargo;

/// <summary>
/// Resultado do parsing de um arquivo .docx — Request pronto para criar/atualizar
/// uma <see cref="Domain.Entities.DescricaoCargo"/> + warnings sobre seções não
/// reconhecidas ou parciais.
/// </summary>
public sealed record DocxParseResult(
    DescricaoCargoCreateRequest? Request,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Parser de .docx que detecta as seções do template DNALIO (referência: anexo
/// "Assistente de Suporte Tecnico.docx" do usuário) e mapeia para o request de
/// criação. Usa <see cref="DocumentFormat.OpenXml"/> da Microsoft (free, embedado
/// via NuGet).
///
/// <para><b>Estratégia</b>: percorre os parágrafos sequencialmente. Cada parágrafo
/// pode ser:
/// <list type="bullet">
///   <item>Um <b>título de seção</b> (ex.: "Descrição Sumária", "Atividades Específicas",
///         "Competências Comportamentais – DNALIO") — detectado por match normalizado
///         (sem acento, lowercase) contra um dicionário de aliases conhecidos.</item>
///   <item>Um <b>par chave-valor</b> (ex.: "Cargo:", "CBO:", "Tempo Mínimo:") — detectado
///         pelo padrão "label: valor" ou label numa linha e valor na seguinte.</item>
///   <item>Um <b>item de lista</b> (bullet/numeração) ou parágrafo solto — coletado
///         para a seção corrente.</item>
/// </list>
/// </para>
///
/// <para><b>Limites</b>: o parser é heurístico. Se o documento usa uma estrutura
/// muito diferente (sem seções nomeadas, ou com nomes muito diferentes), o resultado
/// será parcial e os warnings indicarão. Para garantir cobertura total, o template
/// deve seguir o modelo DNALIO de referência.</para>
/// </summary>
public static class DocxDescricaoCargoParser
{
    /// <summary>
    /// Aliases por seção (normalizado: sem acento, minúsculo, sem pontuação).
    /// Cada chave é o nome canônico interno; valor é a lista de strings que
    /// disparam essa seção.
    /// </summary>
    private static readonly Dictionary<string, string[]> SecaoAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["descricao_sumaria"] = ["descricao sumaria", "descricao sumario", "resumo", "missao do cargo"],
        ["atividades_especificas"] = ["atividades especificas", "principais atividades", "atribuicoes"],
        ["atividades_comuns"] = ["atividades comuns", "atividades comuns ao nivel do cargo", "atividades gerais"],
        ["formacao"] = ["formacao", "escolaridade"],
        ["experiencia"] = ["experiencia", "experiencia profissional"],
        ["vivencias"] = ["vivencias", "experiencias vivencias especificas", "vivencias especificas", "experiencia vivencia especifica"],
        ["comp_dnalio"] = ["competencias comportamentais dnalio", "comportamentais dnalio", "dnalio"],
        ["comp_lideranca"] = ["competencias de lideranca", "competencias de lideranca e relacionamento", "lideranca e relacionamento"],
        ["comp_funcionais"] = [
            "competencias comportamentais funcionais",
            "competencias comportamentais habilidades e atitudes funcionais", // variante DNALIO completa (com "Habilidades e Atitudes")
            "habilidades e atitudes funcionais",
            "comportamentais funcionais"
        ],
        ["comp_tecnicas"] = [
            "competencias tecnicas",
            "competencias tecnicas conhecimentos e habilidades tecnicas", // variante DNALIO completa
            "conhecimentos tecnicos",
            "habilidades tecnicas",
            "conhecimentos e habilidades tecnicas"
        ],
        ["requisitos"] = ["requisitos obrigatorios", "perfil da vaga", "requisitos obrigatorios perfil da vaga"],
        ["revisao"] = ["revisao e aprovacao", "revisao"],
    };

    /// <summary>Pares chave-valor que aparecem inline (ex.: "Cargo: Assistente").</summary>
    private static readonly Dictionary<string, string[]> CampoAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["title"] = ["cargo"],
        ["areaTemplate"] = ["area"],
        ["cboCodigo"] = ["cbo"],
        ["formacaoMinima"] = ["minima", "formacao minima"],
        ["formacaoDesejavel"] = ["desejavel", "formacao desejavel"],
        ["formacaoAreaEstudo"] = ["area de estudo"],
        ["experienciaTempoMinimo"] = ["tempo minimo"],
        ["experienciaTempoDesejavel"] = ["tempo desejavel"],
        ["experienciaEspecificacao"] = ["especificacao"],
        ["revisaoNumero"] = ["revisao no", "revisao n"],
        ["revisaoData"] = ["data"],
        ["revisaoNatureza"] = ["natureza da revisao", "natureza"],
        ["gestorNome"] = ["gestor"],
        ["gestorEmail"] = ["e-mail", "email"],
    };

    /// <summary>Parseia o stream de um .docx e retorna um Request preenchido + warnings.</summary>
    public static DocxParseResult Parse(Stream stream, string suggestedCode)
    {
        var warnings = new List<string>();

        // Estados que vão sendo populados
        var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var itensPorSecao = new Dictionary<string, List<DescricaoCargoItemRequest>>(StringComparer.OrdinalIgnoreCase);
        string? currentSecao = null;
        // Para campos com valor na linha seguinte (estilo "Cargo:\nAssistente de Suporte")
        string? expectingValueForCampo = null;

        try
        {
            using var doc = WordprocessingDocument.Open(stream, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body is null)
                return new DocxParseResult(null, new[] { "Documento .docx vazio ou inválido (sem body)." });

            // Itera por parágrafos e células de tabela na ordem de aparição
            foreach (var element in body.Descendants<Paragraph>())
            {
                var raw = ExtractParagraphText(element);
                if (string.IsNullOrWhiteSpace(raw)) continue;

                var text = raw.Trim();
                var normalized = NormalizeForMatch(text);

                // 1. É um par "Label: Valor" inline?
                var colonIdx = text.IndexOf(':');
                if (colonIdx > 0 && colonIdx < text.Length - 1)
                {
                    var label = text.Substring(0, colonIdx).Trim();
                    var value = text.Substring(colonIdx + 1).Trim();
                    var labelNorm = NormalizeForMatch(label);
                    if (TryMatchCampo(labelNorm, out var campoKey))
                    {
                        fields[campoKey] = value;
                        expectingValueForCampo = null;
                        continue;
                    }
                }

                // 2. É um label de campo numa linha sozinho? (próxima linha vai ser o valor)
                if (TryMatchCampo(NormalizeForMatch(text.TrimEnd(':').Trim()), out var soloCampo))
                {
                    expectingValueForCampo = soloCampo;
                    continue;
                }

                // 3. Estamos esperando valor de um campo? Então essa linha É o valor
                if (expectingValueForCampo is not null)
                {
                    fields[expectingValueForCampo] = text;
                    expectingValueForCampo = null;
                    continue;
                }

                // 4. É um título de seção?
                if (TryMatchSecao(normalized, out var secaoKey))
                {
                    currentSecao = secaoKey;
                    if (!itensPorSecao.ContainsKey(secaoKey))
                        itensPorSecao[secaoKey] = new List<DescricaoCargoItemRequest>();
                    continue;
                }

                // 5. É item da seção corrente?
                if (currentSecao is not null && IsListItemOrParagraph(text))
                {
                    var (texto, isObrigatoria) = ExtractObrigatorio(text);
                    if (string.IsNullOrWhiteSpace(texto)) continue;

                    var categoria = MapSecaoToCategoria(currentSecao);
                    if (categoria is null)
                    {
                        // Seções como "descricao_sumaria", "formacao", etc. NÃO viram itens —
                        // viram campos escalares. Vamos consolidar:
                        ConsolidarTextoParaCampo(currentSecao, text, fields);
                        continue;
                    }

                    itensPorSecao.TryAdd(currentSecao, new List<DescricaoCargoItemRequest>());
                    var items = itensPorSecao[currentSecao];
                    items.Add(new DescricaoCargoItemRequest(
                        Categoria: categoria.Value,
                        Texto: TruncateToMax(texto, 500),
                        IsObrigatoria: isObrigatoria,
                        NivelMinimo: null,
                        Subcategoria: null,
                        Ordem: items.Count));
                }
            }

            // Também extraímos texto de tabelas (cabeçalho do template DNALIO usa tabelas)
            // — texto de células que matcham campo/seção também são consumidos
            foreach (var cell in body.Descendants<TableCell>())
            {
                var raw = ExtractCellText(cell);
                if (string.IsNullOrWhiteSpace(raw)) continue;
                var text = raw.Trim();
                var colonIdx = text.IndexOf(':');
                if (colonIdx > 0 && colonIdx < text.Length - 1)
                {
                    var label = text.Substring(0, colonIdx).Trim();
                    var value = text.Substring(colonIdx + 1).Trim();
                    if (TryMatchCampo(NormalizeForMatch(label), out var key) && !fields.ContainsKey(key))
                        fields[key] = value;
                }
            }
        }
        catch (Exception ex)
        {
            return new DocxParseResult(null, new[] { $"Erro ao ler .docx: {ex.GetType().Name} — {ex.Message}" });
        }

        // ── Constrói o Request final ─────────────────────────────────────────

        var title = TruncateToMax(GetField(fields, "title") ?? Path.GetFileNameWithoutExtension(suggestedCode), 200);
        if (string.IsNullOrWhiteSpace(title))
        {
            warnings.Add("Não foi possível identificar o Cargo (procurado por 'Cargo:' no documento). Usando nome do arquivo.");
            title = "Sem título";
        }

        DateOnly? revisaoData = null;
        var revisaoStr = GetField(fields, "revisaoData");
        if (!string.IsNullOrWhiteSpace(revisaoStr))
        {
            if (DateOnly.TryParseExact(revisaoStr, "dd/MM/yyyy", null, DateTimeStyles.None, out var d) ||
                DateOnly.TryParseExact(revisaoStr, "yyyy-MM-dd", null, DateTimeStyles.None, out d))
            {
                revisaoData = d;
            }
        }

        var allItens = new List<DescricaoCargoItemRequest>();
        foreach (var kv in itensPorSecao)
        {
            allItens.AddRange(kv.Value);
        }

        // Avisa se nenhuma seção de itens foi reconhecida
        var totalItens = allItens.Count;
        if (totalItens == 0)
        {
            warnings.Add(
                "Nenhum item DNALIO foi extraído (Atividades / Vivências / Competências / Requisitos). " +
                "Verifique se o documento segue o template DNALIO com seções nomeadas.");
        }

        var request = new DescricaoCargoCreateRequest(
            Code: TruncateToMax(suggestedCode, 30),
            Title: title,
            AreaTemplate: TruncateToMax(GetField(fields, "areaTemplate"), 120),
            CboCodigo: TruncateToMax(GetField(fields, "cboCodigo"), 20),
            Summary: TruncateToMax(GetField(fields, "descricao_sumaria"), 2000),
            FormacaoMinima: TruncateToMax(GetField(fields, "formacaoMinima"), 200),
            FormacaoDesejavel: TruncateToMax(GetField(fields, "formacaoDesejavel"), 200),
            FormacaoAreaEstudo: TruncateToMax(GetField(fields, "formacaoAreaEstudo"), 200),
            ExperienciaTempoMinimo: TruncateToMax(GetField(fields, "experienciaTempoMinimo"), 80),
            ExperienciaTempoDesejavel: TruncateToMax(GetField(fields, "experienciaTempoDesejavel"), 80),
            ExperienciaEspecificacao: TruncateToMax(GetField(fields, "experienciaEspecificacao"), 500),
            RevisaoNumero: TruncateToMax(GetField(fields, "revisaoNumero"), 10),
            RevisaoData: revisaoData,
            RevisaoNatureza: TruncateToMax(GetField(fields, "revisaoNatureza"), 200),
            GestorNome: TruncateToMax(GetField(fields, "gestorNome"), 200),
            GestorEmail: TruncateToMax(GetField(fields, "gestorEmail"), 200),
            Responsibilities: null,
            Requirements: null,
            NiceToHave: null,
            Benefits: null,
            Itens: allItens,
            IsTemplate: true, // por padrão, importações entram como template
            IsActive: true,
            NivelCargoId: null);

        return new DocxParseResult(request, warnings);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string ExtractParagraphText(Paragraph p)
    {
        var sb = new StringBuilder();
        foreach (var t in p.Descendants<Text>())
        {
            sb.Append(t.Text);
        }
        return sb.ToString();
    }

    private static string ExtractCellText(TableCell c)
    {
        var sb = new StringBuilder();
        foreach (var p in c.Descendants<Paragraph>())
        {
            var txt = ExtractParagraphText(p);
            if (!string.IsNullOrWhiteSpace(txt))
            {
                if (sb.Length > 0) sb.Append('\n');
                sb.Append(txt);
            }
        }
        return sb.ToString();
    }

    /// <summary>Normaliza para matching: NFD, sem acento, minúsculo, sem pontuação além de espaços.</summary>
    private static string NormalizeForMatch(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        var normalized = s.Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(c) || c == ' ') sb.Append(char.ToLowerInvariant(c));
            // Separadores tipográficos viram espaço — evita "Experiências/Vivências" virar
            // "experienciasvivencias" (seção DNALIO real do template).
            else if (c == '–' || c == '-' || c == '/' || c == '|' || c == ';' || c == ',') sb.Append(' ');
        }
        return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>
    /// Casa o título normalizado da célula/parágrafo contra os aliases de seções.
    ///
    /// <para><b>Estratégia em 2 passes</b>: (1) equality exata (comportamento antigo,
    /// mais conservador); (2) se ninguém bater, tenta match por <i>contains</i> —
    /// aceita "Competências Técnicas – Conhecimentos e Habilidades Técnicas" casando
    /// o alias "competencias tecnicas" porque ele aparece como prefix/substring.
    /// Aliases ordenados do mais específico ao mais genérico para evitar que
    /// "competencias" sozinho case com DNALIO (que tem alias "dnalio" próprio).</para>
    ///
    /// <para>Descarta matches curtos (&lt; 3 palavras no normalized) para não confundir
    /// com conteúdo de item que acidentalmente contém palavra-chave de seção.</para>
    /// </summary>
    private static bool TryMatchSecao(string normalized, out string key)
    {
        if (string.IsNullOrEmpty(normalized))
        {
            key = string.Empty;
            return false;
        }

        // Pass 1: equality exata (prioritária — resolve casos canônicos direto).
        foreach (var kv in SecaoAliases)
        {
            foreach (var alias in kv.Value)
            {
                if (string.Equals(normalized, alias, StringComparison.Ordinal))
                {
                    key = kv.Key;
                    return true;
                }
            }
        }

        // Pass 2: contains fuzzy — títulos longos com sufixo descritivo
        // ("Competências Técnicas – Conhecimentos e Habilidades Técnicas") casam
        // com alias "competencias tecnicas".
        // Limita a normalized curtos (≤ 15 palavras) para não consumir itens de lista.
        var wordCount = 0;
        for (int i = 0; i < normalized.Length; i++) if (normalized[i] == ' ') wordCount++;
        wordCount++;
        if (wordCount > 15)
        {
            key = string.Empty;
            return false;
        }

        foreach (var kv in SecaoAliases)
        {
            foreach (var alias in kv.Value)
            {
                // Ignora aliases muito curtos no fuzzy (evita falso positivo).
                // 1 palavra sozinha ("experiencia", "formacao") nunca faz fuzzy — senão
                // case em qualquer item de lista que contenha essa palavra ("Experiência
                // anterior em suporte técnico" viraria seção "experiencia").
                if (alias.Length < 10) continue;
                if (CountWords(alias) < 2) continue;
                if (normalized.Contains(alias, StringComparison.Ordinal))
                {
                    key = kv.Key;
                    return true;
                }
            }
        }

        key = string.Empty;
        return false;
    }

    /// <summary>Conta palavras separadas por espaço num texto já normalizado.</summary>
    private static int CountWords(string s)
    {
        if (string.IsNullOrEmpty(s)) return 0;
        int count = 1;
        for (int i = 0; i < s.Length; i++) if (s[i] == ' ') count++;
        return count;
    }

    private static bool TryMatchCampo(string normalized, out string key)
    {
        foreach (var kv in CampoAliases)
        {
            foreach (var alias in kv.Value)
            {
                if (string.Equals(normalized, alias, StringComparison.Ordinal))
                {
                    key = kv.Key;
                    return true;
                }
            }
        }
        key = string.Empty;
        return false;
    }

    private static DescricaoCargoItemCategoria? MapSecaoToCategoria(string secao) => secao switch
    {
        "atividades_especificas" => DescricaoCargoItemCategoria.AtividadeEspecifica,
        "atividades_comuns" => DescricaoCargoItemCategoria.AtividadeComum,
        "vivencias" => DescricaoCargoItemCategoria.VivenciaEspecifica,
        "comp_dnalio" => DescricaoCargoItemCategoria.CompetenciaDnalio,
        "comp_lideranca" => DescricaoCargoItemCategoria.CompetenciaLideranca,
        "comp_funcionais" => DescricaoCargoItemCategoria.CompetenciaFuncional,
        "comp_tecnicas" => DescricaoCargoItemCategoria.CompetenciaTecnica,
        "requisitos" => DescricaoCargoItemCategoria.RequisitoObrigatorio,
        _ => null,
    };

    /// <summary>
    /// Para seções que não viram itens (descricao_sumaria, formacao, experiencia, revisao),
    /// concatena o texto no campo escalar correspondente.
    /// </summary>
    private static void ConsolidarTextoParaCampo(string secao, string text, Dictionary<string, string> fields)
    {
        var key = secao switch
        {
            "descricao_sumaria" => "descricao_sumaria",
            "formacao" => "formacao_bloco", // marker — agregado depois
            "experiencia" => "experiencia_bloco",
            "revisao" => "revisao_bloco",
            _ => null,
        };
        if (key is null) return;

        if (fields.TryGetValue(key, out var existing))
            fields[key] = existing + "\n" + text;
        else
            fields[key] = text;

        // Se o campo escalar específico não foi pego inline e o bloco tem texto, herda
        if (key == "descricao_sumaria" && !fields.ContainsKey("descricao_sumaria_value"))
            fields["descricao_sumaria_value"] = fields[key];
    }

    private static string? GetField(Dictionary<string, string> fields, string key)
    {
        if (fields.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v))
            return v.Trim();
        // Fallback pro bloco
        if (key == "descricao_sumaria" && fields.TryGetValue("descricao_sumaria_value", out var sumario))
            return sumario.Trim();
        return null;
    }

    /// <summary>Detecta se o texto começa com bullet/numeração que indica item de lista.</summary>
    private static bool IsListItemOrParagraph(string text) => text.Length > 0; // Aceita qualquer parágrafo não vazio (já filtrado antes)

    /// <summary>
    /// Identifica padrão "Texto - Obrigatório" ou "Texto (Obrigatório)" e separa.
    /// </summary>
    private static (string Texto, bool IsObrigatoria) ExtractObrigatorio(string text)
    {
        var lower = text.ToLowerInvariant();
        if (lower.EndsWith("obrigatorio") || lower.EndsWith("obrigatório"))
        {
            var clean = System.Text.RegularExpressions.Regex.Replace(text, @"[\s\-\(\)]*obrigat[oó]rio[\s\(\)]*$", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
            return (clean, true);
        }
        if (lower.EndsWith("desejavel") || lower.EndsWith("desejável"))
        {
            var clean = System.Text.RegularExpressions.Regex.Replace(text, @"[\s\-\(\)]*desej[aá]vel[\s\(\)]*$", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
            return (clean, false);
        }
        // Default: obrigatório true (alinhado com regra de IsObrigatoria=true por default)
        return (text, true);
    }

    private static string? TruncateToMax(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var trimmed = s.Trim();
        return trimmed.Length <= max ? trimmed : trimmed.Substring(0, max);
    }
}
