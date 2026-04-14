using System.Text.Json;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Contracts.AdmissaoPortal;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.AdmissaoPortal;

/// <summary>
/// Usa GPT-4o (vision) para validar documentos e extrair campos automaticamente.
/// </summary>
public sealed class DocumentAiExtractor
{
    private readonly IUnifiedAiService _ai;
    private readonly ILogger<DocumentAiExtractor> _logger;

    public DocumentAiExtractor(IUnifiedAiService ai, ILogger<DocumentAiExtractor> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    public async Task<DocumentValidationResponse> ExtractAsync(
        string tenantId,
        TipoDocumento tipoDocumento,
        string imageBase64,
        string mediaType,
        CancellationToken ct)
    {
        var tipoLabel = GetDocumentLabel(tipoDocumento);

        // ── Passo 1: gpt-4o descreve tudo que vê na imagem em texto livre ──
        string descricao;
        try
        {
            descricao = await DescribeImageAsync(tenantId, tipoLabel, imageBase64, mediaType, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Passo 1 (descrição) falhou para documento tipo {Tipo}", tipoDocumento);
            return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                "Erro ao acessar o serviço de IA. O documento foi salvo — preencha os dados manualmente.");
        }

        if (string.IsNullOrWhiteSpace(descricao))
        {
            _logger.LogWarning("Passo 1 retornou vazio para tipo {Tipo}. Verifique se o modelo suporta visão (gpt-4o).", tipoDocumento);
            return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                "Serviço de análise de IA indisponível. O documento foi salvo — preencha os dados manualmente na próxima etapa.");
        }

        if (descricao.StartsWith("AI_ERROR:", StringComparison.Ordinal))
        {
            var errorDetail = descricao["AI_ERROR:".Length..].Trim();
            _logger.LogWarning("OpenAI retornou erro no Passo 1 para {Tipo}: {Error}", tipoDocumento, errorDetail);
            return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                $"Erro na API de IA: {errorDetail}. O documento foi salvo — preencha os dados manualmente.");
        }

        _logger.LogDebug("Passo 1 concluído para {Tipo}. Descrição: {Descricao}", tipoDocumento, descricao);

        // ── Passo 2: gpt-4o-mini extrai campos estruturados da descrição ──
        try
        {
            var camposEsperados = GetExpectedFields(tipoDocumento);
            var extractionResult = await ExtractFieldsFromDescriptionAsync(tenantId, tipoLabel, camposEsperados, descricao, ct);
            return extractionResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Passo 2 (extração) falhou para documento tipo {Tipo}", tipoDocumento);
            return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                "Erro ao estruturar os dados do documento. O documento foi salvo — preencha os dados manualmente.");
        }
    }

    /// <summary>
    /// Passo 1 — gpt-4o lê a imagem e descreve em texto livre tudo que vê,
    /// sem se preocupar com formato ou estrutura.
    /// </summary>
    private async Task<string> DescribeImageAsync(
        string tenantId, string tipoLabel, string imageBase64, string mediaType, CancellationToken ct)
    {
        const string systemPrompt =
            "Você é um leitor especializado em documentos brasileiros. " +
            "Sua única tarefa é transcrever com máxima fidelidade TUDO que está escrito na imagem. " +
            "Liste cada campo e seu valor exatamente como aparecem, incluindo todos os números, letras, datas e siglas. " +
            "Não interprete, não corrija e não omita nada. Se um texto estiver ilegível, diga 'ilegível'.";

        var payload = new
        {
            prompt = systemPrompt,
            cvText = $"Transcreva todos os textos e números visíveis nesta imagem de {tipoLabel}.",
            imageBase64,
            imageMediaType = mediaType
        };

        var request = new AiInvokeRequest(
            Module: "DocValidation",
            ActionDescription: $"Passo 1 – Descrever imagem de {tipoLabel}",
            RequestMessage: null,
            ModelId: null,
            Payload: payload
        );

        var result = await _ai.InvokeAsync(tenantId, null, "Sistema", request, ct);
        return result?.Content ?? string.Empty;
    }

    /// <summary>
    /// Passo 2 — gpt-4o-mini recebe a descrição textual e extrai os campos no formato JSON esperado.
    /// </summary>
    private async Task<DocumentValidationResponse> ExtractFieldsFromDescriptionAsync(
        string tenantId, string tipoLabel, string camposEsperados, string descricao, CancellationToken ct)
    {
        var systemPrompt = BuildExtractionPrompt(tipoLabel, camposEsperados);

        var userText =
            $"A seguir está a transcrição de um documento do tipo \"{tipoLabel}\" feita por um leitor de imagens:\n\n" +
            $"{descricao}\n\n" +
            "Com base nessa transcrição, extraia os campos no formato JSON solicitado.";

        var payload = new
        {
            prompt = systemPrompt,
            cvText = userText
        };

        var request = new AiInvokeRequest(
            Module: "DocValidation",
            ActionDescription: $"Passo 2 – Extrair campos de {tipoLabel}",
            RequestMessage: null,
            ModelId: null,
            Payload: payload
        );

        var result = await _ai.InvokeAsync(tenantId, null, "Sistema", request, ct);
        if (result is null || string.IsNullOrWhiteSpace(result.Content))
            return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                "Não foi possível estruturar os dados. O documento foi salvo — preencha os dados manualmente.");

        if (result.Content.StartsWith("AI_ERROR:", StringComparison.Ordinal))
        {
            var errorDetail = result.Content["AI_ERROR:".Length..].Trim();
            return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                $"Erro na API de IA: {errorDetail}. O documento foi salvo — preencha os dados manualmente.");
        }

        return ParseResponse(result.Content, tipoLabel);
    }

    private static string BuildExtractionPrompt(string tipoLabel, string camposEsperados)
    {
        return $"Você é um especialista em leitura de documentos brasileiros. Você receberá a transcrição textual de um documento do tipo \"{tipoLabel}\" feita por um leitor de imagens. Execute DUAS tarefas:\n\n"
            + "1. VALIDAÇÃO:\n"
            + $"   - isValid = true se a transcrição corresponder a um \"{tipoLabel}\" (frente OU verso são válidos).\n"
            + "   - isValid = false SOMENTE se for um tipo de documento completamente diferente ou ilegível.\n\n"
            + "2. EXTRAÇÃO — extraia APENAS o que estiver CLARAMENTE PRESENTE na transcrição:\n"
            + $"   {camposEsperados}\n\n"
            + "REGRAS ABSOLUTAS — LEIA COM ATENÇÃO:\n"
            + "- NUNCA invente, assuma ou deduza valores. Se um campo não estiver claramente visível, retorne null.\n"
            + "- NUNCA use informações de um campo para preencher outro campo.\n"
            + "- NUNCA confunda o número do RG com o número do CPF. São campos completamente distintos.\n"
            + "  * 'rg' recebe SOMENTE o número rotulado como 'REGISTRO GERAL' ou 'RG' no documento.\n"
            + "  * 'cpf' recebe SOMENTE o número rotulado como 'CPF' no documento (sempre 11 dígitos).\n"
            + "  * O novo RG brasileiro (CIN) contém AMBOS — extraia cada um no campo correto.\n"
            + "- DATAS: sempre no formato YYYY-MM-DD. Exemplo: '21/06/1991' → '1991-06-21'. Se a data estiver ilegível, retorne null.\n"
            + "- CPF: apenas os 11 dígitos numéricos, sem pontos ou traço. Exemplo: '396.725.378-32' → '39672537832'.\n"
            + "- SEXO: retorne APENAS 'M' para masculino ou 'F' para feminino. Leia exatamente o que está impresso no campo 'SEXO'. Se não estiver visível, retorne null.\n"
            + "- FILIAÇÃO (nomeMae / nomePai):\n"
            + "  * 'nomeMae' = nome da mãe — primeira pessoa listada em 'FILIAÇÃO', ou a explicitamente rotulada como mãe.\n"
            + "  * 'nomePai' = nome do pai — segunda pessoa listada em 'FILIAÇÃO', ou a explicitamente rotulada como pai.\n"
            + "  * Se apenas um nome de filiação estiver visível, preencha somente o campo correspondente, deixe o outro null.\n"
            + "  * NUNCA use o nome do titular no lugar do nome do pai ou da mãe.\n"
            + "- NATURALIDADE (naturalCidade / naturalUf): leia exatamente o que está impresso no campo 'NATURALIDADE' ou 'LOCAL DE NASCIMENTO'. Se não estiver visível, retorne null.\n"
            + "- NACIONALIDADE: leia exatamente o que está impresso no campo 'NACIONALIDADE'. Exemplos: 'BRASILEIRO', 'BRASILEIRA'. Se não estiver visível, retorne null.\n"
            + "- CEP: apenas dígitos, sem hífen.\n"
            + "- Campos do outro lado do documento (não presentes na transcrição) = null.\n\n"
            + "Responda APENAS com JSON válido. Sem markdown, sem explicações, sem texto adicional:\n"
            + "{\n"
            + "    \"isValid\": true ou false,\n"
            + "    \"confidence\": número de 0.0 a 1.0,\n"
            + "    \"documentType\": \"tipo detectado (ex: RG - frente, RG - verso, RG CIN)\",\n"
            + "    \"extractedFields\": { \"campo1\": \"valor ou null\" },\n"
            + "    \"validationMessage\": \"mensagem se inválido, null se válido\"\n"
            + "}";
    }

    private static string GetExpectedFields(TipoDocumento tipo) => tipo switch
    {
        TipoDocumento.RG =>
            // Frente: nome, filiação, data de nascimento, naturalidade, sexo, foto
            // Verso / CIN: CPF, número RG (Registro Geral), CNH, T. Eleitor, NIS/PIS, data expedição, órgão
            "nome (nome completo conforme impresso no documento)\n"
            + "   rg: SOMENTE o número de REGISTRO GERAL (campo rotulado 'REGISTRO GERAL' ou 'RG' — ex: 48.411.026-3). NÃO colocar o CPF aqui.\n"
            + "   cpf: SOMENTE o número do CPF (campo rotulado 'CPF' — apenas 11 dígitos sem pontuação). O novo RG brasileiro (CIN) traz CPF e RG como campos SEPARADOS.\n"
            + "   rgOrgaoExpedidor: sigla do órgão (ex: SSP, IFP, DETRAN)\n"
            + "   rgUfExpedidor: UF do órgão (ex: SP)\n"
            + "   rgDataExpedicao: data de expedição/emissão no formato YYYY-MM-DD\n"
            + "   dataNascimento: data de nascimento no formato YYYY-MM-DD\n"
            + "   nomeMae: nome da mãe — em 'FILIAÇÃO', primeira pessoa listada ou a rotulada como mãe\n"
            + "   nomePai: nome do pai — em 'FILIAÇÃO', segunda pessoa listada ou a rotulada como pai\n"
            + "   sexo: 'M' para masculino, 'F' para feminino\n"
            + "   naturalCidade: cidade de naturalidade\n"
            + "   naturalUf: UF de naturalidade (ex: SP)\n"
            + "   nacionalidade: ex 'BRASILEIRO' ou 'BRASILEIRA'\n"
            + "   cnhNumero: número da CNH se impresso no documento (novo RG/CIN inclui este campo)\n"
            + "   pisPasep: número PIS/NIS/PASEP se impresso no documento",

        TipoDocumento.CPF => "cpf (apenas 11 dígitos sem pontuação), nome",

        TipoDocumento.CNH =>
            "cnhNumero (número do registro CNH)\n"
            + "   categoriaCnh (ex: AB, B, D)\n"
            + "   cnhUf\n"
            + "   cnhOrgaoEmissor\n"
            + "   cnhDataExpedicao (formato YYYY-MM-DD)\n"
            + "   cnhPrimeiraHabilitacao (formato YYYY-MM-DD)\n"
            + "   validadeCnh (formato YYYY-MM-DD)\n"
            + "   nome, cpf (apenas 11 dígitos), rg, dataNascimento (formato YYYY-MM-DD)",

        TipoDocumento.ComprovanteResidencia => "cep (apenas números sem hífen), logradouro, numero, complemento, bairro, cidade, uf",
        TipoDocumento.ComprovanteBancario => "bancoCodigo, bancoNome, agencia, agenciaDigito, conta, contaDigito, tipoConta",
        TipoDocumento.CarteiraTrabalhoCTPS => "ctps, ctpsSerie, ctpsUf, pisPasep",
        TipoDocumento.TituloEleitor => "tituloEleitorNumero, tituloEleitorZona, tituloEleitorSecao, tituloEleitorCidade, tituloEleitorUf",
        TipoDocumento.Reservista => "reservistaNumero, docMilitarTipo, docMilitarNumero, docMilitarSerie, docMilitarRegiao, docMilitarCircunscricao",
        TipoDocumento.CertidaoNascimentoCasamento => "estadoCivil, nacionalidade",
        TipoDocumento.PisPasep => "pisPasep, nome",
        TipoDocumento.RGFilho => "nome, rg, cpf (se presente), dataNascimento (formato YYYY-MM-DD), nomeMae, nomePai",
        TipoDocumento.CertidaoNascimentoFilho => "nome, dataNascimento (formato YYYY-MM-DD), nomeMae, nomePai",
        _ => "todos os campos legíveis do documento"
    };

    private static string GetDocumentLabel(TipoDocumento tipo) => tipo switch
    {
        TipoDocumento.RG => "RG (Registro Geral)",
        TipoDocumento.CPF => "CPF (Cadastro de Pessoa Física)",
        TipoDocumento.CNH => "CNH (Carteira Nacional de Habilitação)",
        TipoDocumento.TituloEleitor => "Título de Eleitor",
        TipoDocumento.Reservista => "Certificado de Reservista",
        TipoDocumento.ComprovanteResidencia => "Comprovante de Residência",
        TipoDocumento.CertidaoNascimentoCasamento => "Certidão de Nascimento ou Casamento",
        TipoDocumento.PisPasep => "PIS/PASEP",
        TipoDocumento.CarteiraTrabalhoCTPS => "Carteira de Trabalho (CTPS)",
        TipoDocumento.ComprovanteBancario => "Comprovante Bancário",
        TipoDocumento.Foto3x4 => "Foto 3x4",
        TipoDocumento.Escolaridade => "Comprovante de Escolaridade",
        TipoDocumento.DeclaracaoUniaoEstavel => "Declaração de União Estável",
        TipoDocumento.RGFilho => "RG do(a) Filho(a)",
        TipoDocumento.CertidaoNascimentoFilho => "Certidão de Nascimento do(a) Filho(a)",
        TipoDocumento.CarteiraVacinacaoFilho => "Carteira de Vacinação do(a) Filho(a)",
        _ => "Documento"
    };

    private DocumentValidationResponse ParseResponse(string content, string fallbackType)
    {
        try
        {
            // Strip markdown fences if present
            var cleaned = content.Trim();
            if (cleaned.StartsWith("```"))
            {
                var firstNewline = cleaned.IndexOf('\n');
                if (firstNewline > 0) cleaned = cleaned[(firstNewline + 1)..];
                if (cleaned.EndsWith("```")) cleaned = cleaned[..^3];
                cleaned = cleaned.Trim();
            }

            using var doc = JsonDocument.Parse(cleaned);
            var root = doc.RootElement;

            var isValid = root.TryGetProperty("isValid", out var v) && v.GetBoolean();
            var confidence = root.TryGetProperty("confidence", out var conf) ? conf.GetSingle() : 0f;
            var documentType = root.TryGetProperty("documentType", out var dt) ? dt.GetString() ?? fallbackType : fallbackType;
            var validationMessage = root.TryGetProperty("validationMessage", out var vm) ? vm.GetString() : null;

            var extractedFields = new Dictionary<string, string?>();
            if (root.TryGetProperty("extractedFields", out var fields) && fields.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in fields.EnumerateObject())
                {
                    extractedFields[prop.Name] = prop.Value.ValueKind == JsonValueKind.Null
                        ? null
                        : prop.Value.ToString();
                }
            }

            return new DocumentValidationResponse(isValid, confidence, documentType, extractedFields, validationMessage);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao parsear resposta da IA para validação de documento");
            return new DocumentValidationResponse(false, 0f, fallbackType, new(), "Erro ao interpretar resposta da análise. Tente novamente.");
        }
    }
}
