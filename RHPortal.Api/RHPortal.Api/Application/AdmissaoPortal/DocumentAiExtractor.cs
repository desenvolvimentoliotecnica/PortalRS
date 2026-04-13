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
        var camposEsperados = GetExpectedFields(tipoDocumento);

        var systemPrompt = BuildSystemPrompt(tipoLabel, camposEsperados);

        var payload = new
        {
            prompt = systemPrompt,
            cvText = $"Analise esta imagem de documento do tipo: {tipoLabel}",
            imageBase64,
            imageMediaType = mediaType
        };

        var request = new AiInvokeRequest(
            Module: "DocValidation",
            ActionDescription: $"Validar e extrair dados de {tipoLabel}",
            RequestMessage: null,
            ModelId: null,
            Payload: payload
        );

        try
        {
            var result = await _ai.InvokeAsync(tenantId, null, "Sistema", request, ct);
            if (result is null || string.IsNullOrWhiteSpace(result.Content))
            {
                _logger.LogWarning("AI retornou vazio para validação de documento tipo {Tipo}. Verifique se o modelo configurado suporta visão (gpt-4o, gpt-4o-mini).", tipoDocumento);
                return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                    "Serviço de análise de IA indisponível. O documento foi salvo — preencha os dados manualmente na próxima etapa.");
            }

            if (result.Content.StartsWith("AI_ERROR:", StringComparison.Ordinal))
            {
                var errorDetail = result.Content["AI_ERROR:".Length..].Trim();
                _logger.LogWarning("OpenAI retornou erro para validação de {Tipo}: {Error}", tipoDocumento, errorDetail);
                return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                    $"Erro na API de IA: {errorDetail}. O documento foi salvo — preencha os dados manualmente.");
            }

            return ParseResponse(result.Content, tipoLabel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao validar documento tipo {Tipo} via IA", tipoDocumento);
            return new DocumentValidationResponse(false, 0f, tipoLabel, new(),
                "Erro ao acessar o serviço de IA. O documento foi salvo — preencha os dados manualmente.");
        }
    }

    private static string BuildSystemPrompt(string tipoLabel, string camposEsperados)
    {
        return "Você é um especialista em leitura de documentos brasileiros. Analise a imagem e execute DUAS tarefas:\n\n"
            + $"1. VALIDAÇÃO: Verifique se a imagem é realmente um documento do tipo \"{tipoLabel}\" (frente OU verso).\n"
            + "   - Documentos com frente e verso podem ser enviados separadamente — AMBOS OS LADOS SÃO VÁLIDOS.\n"
            + "   - isValid = true se a imagem for desse tipo de documento, mesmo que apenas um lado esteja visível.\n"
            + "   - isValid = false SOMENTE se a imagem for de um tipo de documento completamente diferente.\n\n"
            + "2. EXTRAÇÃO: Extraia com precisão TODOS os campos visíveis:\n"
            + $"   {camposEsperados}\n"
            + "   Campos do outro lado do documento devem ter valor null.\n\n"
            + "REGRAS CRÍTICAS DE EXTRAÇÃO:\n"
            + "- DATAS: sempre no formato YYYY-MM-DD. Ex: '21/06/1991' → '1991-06-21'.\n"
            + "- CPF: apenas os 11 dígitos numéricos, sem pontos ou traço. Ex: '396.725.378-32' → '39672537832'.\n"
            + "- RG vs CPF no novo RG brasileiro (CIN): o documento pode conter AMBOS os números.\n"
            + "  * O campo 'rg' recebe SOMENTE o número do 'REGISTRO GERAL' (geralmente no formato XX.XXX.XXX-X).\n"
            + "  * O campo 'cpf' recebe SOMENTE o número do 'CPF' (11 dígitos). São campos DISTINTOS.\n"
            + "  * NUNCA coloque o CPF no campo rg nem o RG no campo cpf.\n"
            + "- FILIAÇÃO: o campo 'nomeMae' recebe o nome da mãe; 'nomePai' recebe o nome do pai.\n"
            + "  * Se apenas um nome estiver em filiação, identifique pelo contexto ou posição (mãe = 1ª linha, pai = 2ª linha).\n"
            + "- CEP: apenas dígitos, sem hífen.\n"
            + "- Se a imagem estiver rotacionada ou inclinada, leia mesmo assim.\n"
            + "- Campos não visíveis neste lado = null (não é erro).\n\n"
            + "Responda APENAS com JSON válido (sem markdown, sem texto extra):\n"
            + "{\n"
            + "    \"isValid\": true/false,\n"
            + "    \"confidence\": 0.0 a 1.0,\n"
            + "    \"documentType\": \"tipo detectado (ex: RG - frente, RG - verso, RG CIN)\",\n"
            + "    \"extractedFields\": { \"campo1\": \"valor\", \"campo2\": null },\n"
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
