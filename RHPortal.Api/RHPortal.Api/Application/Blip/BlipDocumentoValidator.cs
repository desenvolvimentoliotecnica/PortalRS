using System.Text.Json;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Contracts.Ai;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Blip;

/// <summary>
/// Valida documentos para o fluxo Blip usando GPT-4o com os prompts do consigaz-lambda.
/// Mais rigoroso que o DocumentAiExtractor — rejeita documentos do tipo errado.
/// </summary>
public sealed class BlipDocumentoValidator
{
    private readonly IUnifiedAiService _ai;

    public BlipDocumentoValidator(IUnifiedAiService ai)
    {
        _ai = ai;
    }

    /// <summary>
    /// Valida se o documento corresponde ao tipo esperado.
    /// Retorna (valido, tipoDetectado, mensagemErro).
    /// </summary>
    public async Task<(bool Valido, string TipoDetectado, string? MensagemErro)> ValidarAsync(
        string tenantId,
        TipoDocumento tipoEsperado,
        string base64,
        string mimeType,
        CancellationToken ct)
    {
        var tipoEsperadoStr = MapTipoParaLambda(tipoEsperado);
        var systemPrompt    = BuildSystemPrompt(tipoEsperado);

        var payload = new
        {
            prompt         = systemPrompt,
            cvText         = "Analise o documento na imagem fornecida e retorne o JSON solicitado.",
            imageBase64    = base64,
            imageMediaType = mimeType
        };

        var request = new AiInvokeRequest(
            Module:            "BlipValidacao",
            ActionDescription: $"Validar documento tipo {tipoEsperado}",
            RequestMessage:    null,
            ModelId:           null,   // usa o modelo configurado no tenant (gpt-4o)
            Payload:           payload
        );

        var result = await _ai.InvokeAsync(tenantId, null, "Blip", request, ct);

        if (result is null || string.IsNullOrWhiteSpace(result.Content))
            return (false, "Desconhecido", "Não foi possível analisar o documento. Tente novamente.");

        if (result.Content.StartsWith("AI_ERROR:", StringComparison.Ordinal))
            return (false, "Desconhecido", "Erro ao acessar o serviço de análise. Tente novamente.");

        return ParseResposta(result.Content, tipoEsperado, tipoEsperadoStr);
    }

    // ── Parser da resposta JSON do GPT-4o ────────────────────────────────────

    private static (bool Valido, string TipoDetectado, string? MensagemErro) ParseResposta(
        string content, TipoDocumento tipoEsperado, string tipoEsperadoStr)
    {
        try
        {
            var cleaned = content.Trim();
            // Remove markdown code blocks se houver
            if (cleaned.StartsWith("```"))
            {
                var nl = cleaned.IndexOf('\n');
                if (nl > 0) cleaned = cleaned[(nl + 1)..];
                if (cleaned.EndsWith("```")) cleaned = cleaned[..^3];
                cleaned = cleaned.Trim();
            }

            using var doc  = JsonDocument.Parse(cleaned);
            var root       = doc.RootElement;

            var tipoDoc    = root.TryGetProperty("tipoDoc",             out var td)  ? td.GetString()  ?? "Desconhecido" : "Desconhecido";
            var validoStr  = root.TryGetProperty("valido",              out var v)   ? v.GetString()   ?? "false"        : "false";
            var confianca  = root.TryGetProperty("nivelConfiabilidade", out var c)   ? c.GetInt32()    : 0;

            var valido = validoStr.Equals("true", StringComparison.OrdinalIgnoreCase);

            // Se identificou um tipo diferente do esperado, informa o erro antes de checar confiança
            if (!tipoDoc.Equals("Desconhecido", StringComparison.OrdinalIgnoreCase)
                && !TiposCorrespondem(tipoDoc, tipoEsperadoStr))
            {
                var esperadoLabel = TipoDocumentoLabel(tipoEsperado);
                return (false, tipoDoc, $"Arquivo não é {esperadoLabel}. Documento identificado: {tipoDoc}.");
            }

            // Confiança mínima de 40%
            if (confianca < 40)
                return (false, tipoDoc, "Imagem com baixa qualidade ou ilegível. Envie uma foto mais nítida.");

            // Documento inválido (GPT disse que não é o tipo esperado)
            if (!valido)
            {
                var esperadoLabel = TipoDocumentoLabel(tipoEsperado);
                var identificado  = tipoDoc.Equals("Desconhecido", StringComparison.OrdinalIgnoreCase)
                    ? string.Empty
                    : $" Documento identificado: {tipoDoc}.";
                return (false, tipoDoc, $"Arquivo não é {esperadoLabel}.{identificado}");
            }

            // Tipo não identificado
            if (tipoDoc.Equals("Desconhecido", StringComparison.OrdinalIgnoreCase))
                return (false, tipoDoc, "Não foi possível identificar o documento. Envie uma imagem nítida e legível.");

            return (true, tipoDoc, null);
        }
        catch
        {
            return (false, "Desconhecido", "Erro ao interpretar a resposta da análise. Tente novamente.");
        }
    }

    private static bool TiposCorrespondem(string detectado, string esperado)
    {
        // Normaliza e compara
        var d = detectado.Replace(" ", "").ToUpperInvariant();
        var e = esperado.Replace(" ", "").ToUpperInvariant();
        return d.Contains(e) || e.Contains(d);
    }

    // ── System prompts baseados no consigaz-lambda ────────────────────────────

    private static string BuildSystemPrompt(TipoDocumento tipo) => tipo switch
    {
        TipoDocumento.CPF => @"Você é um especialista em leitura de documentos brasileiros.

Analise a imagem e retorne APENAS um JSON válido no formato:
{
  ""tipoDoc"": ""CPF"" ou ""Desconhecido"",
  ""valido"": ""true"" ou ""false"",
  ""nivelConfiabilidade"": número de 0 a 100
}

REGRAS:
- Retorne ""CPF"" SOMENTE se a imagem mostrar claramente um documento CPF (Cadastro de Pessoa Física) emitido pela Receita Federal.
- Se for qualquer outro documento (RG, certidão, conta, etc.), retorne tipoDoc: ""Desconhecido"" e valido: ""false"".
- nivelConfiabilidade: 80-100 imagem clara; 40-79 aceitável; 0-39 ilegível.
- Retorne APENAS o JSON, sem texto adicional.",

        TipoDocumento.RG => @"Você é um especialista em leitura de documentos brasileiros.

Analise a imagem e retorne APENAS um JSON válido no formato:
{
  ""tipoDoc"": ""RG"" ou ""Desconhecido"",
  ""valido"": ""true"" ou ""false"",
  ""nivelConfiabilidade"": número de 0 a 100
}

REGRAS:
- Retorne ""RG"" SOMENTE se a imagem mostrar claramente um RG (Registro Geral / Carteira de Identidade) brasileiro.
- Se for qualquer outro documento, retorne tipoDoc: ""Desconhecido"" e valido: ""false"".
- nivelConfiabilidade: 80-100 imagem clara; 40-79 aceitável; 0-39 ilegível.
- Retorne APENAS o JSON, sem texto adicional.",

        TipoDocumento.CNH => @"Você é um especialista em leitura de documentos brasileiros.

Analise a imagem e retorne APENAS um JSON válido no formato:
{
  ""tipoDoc"": ""CNH"" ou ""Desconhecido"",
  ""valido"": ""true"" ou ""false"",
  ""nivelConfiabilidade"": número de 0 a 100
}

REGRAS:
- Retorne ""CNH"" SOMENTE se a imagem mostrar claramente uma CNH (Carteira Nacional de Habilitação).
- Se for qualquer outro documento, retorne tipoDoc: ""Desconhecido"" e valido: ""false"".
- nivelConfiabilidade: 80-100 imagem clara; 40-79 aceitável; 0-39 ilegível.
- Retorne APENAS o JSON, sem texto adicional.",

        TipoDocumento.ComprovanteResidencia => @"Você é um especialista em leitura de documentos brasileiros.

Analise a imagem e retorne APENAS um JSON válido no formato:
{
  ""tipoDoc"": ""ComprovanteResidencia"" ou ""Desconhecido"",
  ""valido"": ""true"" ou ""false"",
  ""nivelConfiabilidade"": número de 0 a 100
}

REGRAS:
- Retorne ""ComprovanteResidencia"" SOMENTE se a imagem mostrar uma conta de luz, água, telefone, internet, gás ou extrato bancário com endereço.
- Se for qualquer outro documento, retorne tipoDoc: ""Desconhecido"" e valido: ""false"".
- nivelConfiabilidade: 80-100 imagem clara; 40-79 aceitável; 0-39 ilegível.
- Retorne APENAS o JSON, sem texto adicional.",

        _ => $@"Você é um especialista em identificação de documentos brasileiros.

Analise a imagem e retorne APENAS um JSON válido no formato:
{{
  ""tipoDoc"": tipo identificado ou ""Desconhecido"",
  ""valido"": ""true"" ou ""false"",
  ""nivelConfiabilidade"": número de 0 a 100
}}

O documento esperado é: {TipoDocumentoLabel(tipo)}.

REGRAS:
- Retorne o tipo identificado SOMENTE se a imagem mostrar claramente esse tipo de documento.
- Se for um documento diferente do esperado ({TipoDocumentoLabel(tipo)}), retorne tipoDoc com o tipo correto e valido: ""false"".
- Se não conseguir identificar, retorne tipoDoc: ""Desconhecido"" e valido: ""false"".
- nivelConfiabilidade: 80-100 imagem clara; 40-79 aceitável; 0-39 ilegível.
- Retorne APENAS o JSON, sem texto adicional."
    };

    // ── Mapeamento TipoDocumento → string do lambda ───────────────────────────

    private static string MapTipoParaLambda(TipoDocumento tipo) => tipo switch
    {
        TipoDocumento.CPF                       => "CPF",
        TipoDocumento.RG                        => "RG",
        TipoDocumento.CNH                       => "CNH",
        TipoDocumento.ComprovanteResidencia     => "ComprovanteResidencia",
        TipoDocumento.TituloEleitor             => "TituloEleitor",
        TipoDocumento.Reservista                => "Reservista",
        TipoDocumento.PisPasep                  => "PisPasep",
        TipoDocumento.CarteiraTrabalhoCTPS      => "CTPS",
        TipoDocumento.ComprovanteBancario       => "ComprovanteBancario",
        TipoDocumento.CertidaoNascimentoCasamento => "CertidaoNascimentoCasamento",
        _                                       => tipo.ToString()
    };

    public static string TipoDocumentoLabel(TipoDocumento tipo) => tipo switch
    {
        TipoDocumento.RG                          => "RG",
        TipoDocumento.CPF                         => "CPF",
        TipoDocumento.CNH                         => "CNH",
        TipoDocumento.TituloEleitor               => "Título de Eleitor",
        TipoDocumento.Reservista                  => "Reservista",
        TipoDocumento.ComprovanteResidencia       => "Comprovante de Residência",
        TipoDocumento.CertidaoNascimentoCasamento => "Certidão de Nascimento/Casamento",
        TipoDocumento.PisPasep                    => "PIS/PASEP",
        TipoDocumento.CarteiraTrabalhoCTPS        => "Carteira de Trabalho (CTPS)",
        TipoDocumento.ComprovanteBancario         => "Comprovante Bancário",
        _                                         => tipo.ToString()
    };
}
