using System.Net;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Messaging.Email;

public sealed record CandidateEmailTemplateDefinition(
    string Code,
    string DisplayName,
    string Description,
    IReadOnlyList<string> Tags,
    string SubjectDefault,
    string BodyHtmlDefault);

/// <summary>
/// Fonte de verdade dos padrões de fábrica (imutáveis). Seed e Reset usam estes valores.
/// </summary>
public static class CandidateEmailTemplateCatalog
{
    private static readonly string[] TagsEtapa =
    [
        "CandidatoNome", "VagaTitulo", "EmpresaNome",
        "EntrevistaData", "EntrevistaModalidade", "EntrevistaLinkConfirmacao",
    ];

    private static readonly Lazy<IReadOnlyDictionary<string, CandidateEmailTemplateDefinition>> Map =
        new(BuildMap);

    public static IReadOnlyList<CandidateEmailTemplateDefinition> All => Map.Value.Values.OrderBy(x => x.DisplayName).ToList();

    public static bool TryGet(string code, out CandidateEmailTemplateDefinition definition)
        => Map.Value.TryGetValue(code.Trim(), out definition!);

    public static CandidateEmailTemplateDefinition GetRequired(string code)
        => TryGet(code, out var def)
            ? def
            : throw new InvalidOperationException($"Template de e-mail desconhecido: {code}");

    public static string? ResolveCodeForEtapa(EtapaMacroCandidatura etapa) => etapa switch
    {
        EtapaMacroCandidatura.EmTriagem => CandidateEmailTemplateCodes.EtapaEmTriagem,
        EtapaMacroCandidatura.Entrevista => CandidateEmailTemplateCodes.EtapaEntrevista,
        EtapaMacroCandidatura.EntrevistaTecnica => CandidateEmailTemplateCodes.EtapaEntrevistaTecnica,
        EtapaMacroCandidatura.Teste => CandidateEmailTemplateCodes.EtapaTeste,
        EtapaMacroCandidatura.Contratado => CandidateEmailTemplateCodes.EtapaContratado,
        EtapaMacroCandidatura.ReprovadoRh => CandidateEmailTemplateCodes.EtapaReprovadoRh,
        EtapaMacroCandidatura.ReprovadoGestor => CandidateEmailTemplateCodes.EtapaReprovadoGestor,
        EtapaMacroCandidatura.Recusado => CandidateEmailTemplateCodes.EtapaRecusado,
        EtapaMacroCandidatura.Desistiu => CandidateEmailTemplateCodes.EtapaDesistiu,
        // Proposta: e-mail de etapa é skipado; usa PropostaVaga no fluxo dedicado
        _ => null,
    };

    public static bool IsSameAsDefault(string code, string subject, string bodyHtml)
    {
        if (!TryGet(code, out var def)) return false;
        return string.Equals(Normalize(subject), Normalize(def.SubjectDefault), StringComparison.Ordinal)
               && string.Equals(Normalize(bodyHtml), Normalize(def.BodyHtmlDefault), StringComparison.Ordinal);
    }

    private static string Normalize(string? value) => (value ?? string.Empty).Trim().Replace("\r\n", "\n");

    private static IReadOnlyDictionary<string, CandidateEmailTemplateDefinition> BuildMap()
    {
        var items = new[]
        {
            Def(
                CandidateEmailTemplateCodes.CandidaturaConfirmacao,
                "Confirmação de candidatura",
                "Enviado ao candidatar-se pelo portal público.",
                ["CandidatoNome", "VagaTitulo", "PortalAccessKey", "EmpresaNome"],
                "Confirmação da sua candidatura — {{VagaTitulo}}",
                """
                <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
                  <p>Olá, <strong>{{CandidatoNome}}</strong>!</p>
                  <p>Recebemos sua candidatura para a vaga <strong>{{VagaTitulo}}</strong>.</p>
                  <p>Guarde sua chave de acesso ao portal: <strong>{{PortalAccessKey}}</strong></p>
                  <p style="color:#666;font-size:13px;">Atenciosamente,<br/>{{EmpresaNome}}</p>
                </div>
                """),
            Def(
                CandidateEmailTemplateCodes.EtapaEmTriagem,
                "Etapa — Em triagem",
                "Quando a candidatura entra em triagem no Kanban.",
                TagsEtapa,
                "Sua candidatura para {{VagaTitulo}} está em triagem",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Sua candidatura para a vaga {{VagaTitulo}} está em triagem. Em breve avaliaremos seu perfil e daremos um retorno.
                """)),
            Def(
                CandidateEmailTemplateCodes.EtapaEntrevista,
                "Etapa — Entrevista",
                "Avanço para entrevista RH.",
                TagsEtapa,
                "Próximo passo: entrevista para {{VagaTitulo}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Você avançou para a etapa de entrevista na vaga {{VagaTitulo}}.
                Data: {{EntrevistaData}}
                Modalidade: {{EntrevistaModalidade}}
                Confirme sua presença: {{EntrevistaLinkConfirmacao}}
                """)),
            Def(
                CandidateEmailTemplateCodes.EtapaEntrevistaTecnica,
                "Etapa — Entrevista técnica",
                "Avanço para entrevista técnica.",
                TagsEtapa,
                "Próximo passo: entrevista técnica para {{VagaTitulo}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Você avançou para a etapa de entrevista técnica na vaga {{VagaTitulo}}.
                Data: {{EntrevistaData}}
                Modalidade: {{EntrevistaModalidade}}
                Confirme sua presença: {{EntrevistaLinkConfirmacao}}
                """)),
            Def(
                CandidateEmailTemplateCodes.EtapaTeste,
                "Etapa — Teste",
                "Liberação da etapa de testes.",
                TagsEtapa,
                "Teste técnico liberado — {{VagaTitulo}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Liberamos a etapa de testes para a vaga {{VagaTitulo}}. Acompanhe seu e-mail e o portal para as instruções.
                """)),
            Def(
                CandidateEmailTemplateCodes.PropostaVaga,
                "Proposta de vaga",
                "Envio/reenvio do link de aceite da proposta.",
                ["CandidatoNome", "VagaTitulo", "EmpresaNome", "UrlProposta", "PrazoProposta", "Beneficios"],
                "Proposta enviada — {{VagaTitulo}}",
                """
                <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
                  <p>Olá, <strong>{{CandidatoNome}}</strong>!</p>
                  <p>Ficamos felizes em te enviar uma proposta para o cargo de &quot;{{VagaTitulo}}&quot;.</p>
                  <p>Você pode visualizar e aceitar pelo link abaixo:</p>
                  <p><a href="{{UrlProposta}}">{{UrlProposta}}</a></p>
                  <p>Prazo: {{PrazoProposta}}</p>
                  <p><strong>Benefícios:</strong><br/>{{Beneficios}}</p>
                  <p>{{EmpresaNome}} — RH</p>
                </div>
                """),
            Def(
                CandidateEmailTemplateCodes.EtapaReprovadoRh,
                "Etapa — Reprovado (RH)",
                "Encerramento pela triagem/RH.",
                TagsEtapa,
                "Atualização sobre sua candidatura — {{VagaTitulo}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}.
                Agradecemos seu interesse na vaga {{VagaTitulo}}. Após análise do RH, seguiremos com outro candidato neste processo. Sucesso na jornada!
                """)),
            Def(
                CandidateEmailTemplateCodes.EtapaReprovadoGestor,
                "Etapa — Reprovado (gestor)",
                "Encerramento após avaliação do gestor.",
                TagsEtapa,
                "Atualização sobre sua candidatura — {{VagaTitulo}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}.
                Agradecemos seu interesse na vaga {{VagaTitulo}}. Após avaliação do gestor, seguiremos com outro candidato neste processo. Sucesso na jornada!
                """)),
            Def(
                CandidateEmailTemplateCodes.EtapaRecusado,
                "Etapa — Recusado",
                "Candidatura recusada no processo.",
                TagsEtapa,
                "Atualização sobre sua candidatura — {{VagaTitulo}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}.
                Agradecemos seu interesse na vaga {{VagaTitulo}}, mas seguiremos com outro candidato neste processo. Sucesso na jornada!
                """)),
            Def(
                CandidateEmailTemplateCodes.EtapaDesistiu,
                "Etapa — Desistência",
                "Candidato desistiu do processo.",
                TagsEtapa,
                "Candidatura encerrada — {{VagaTitulo}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}.
                Registramos sua desistência do processo da vaga {{VagaTitulo}}. Esperamos você em uma próxima oportunidade.
                """)),
            Def(
                CandidateEmailTemplateCodes.EtapaContratado,
                "Etapa — Contratado / admissão",
                "Início do processo de admissão.",
                TagsEtapa,
                "Processo de admissão iniciado — {{VagaTitulo}}",
                HtmlBody("""
                Parabéns, {{CandidatoNome}}!
                Você está em processo de admissão para a vaga {{VagaTitulo}}. Em breve nossa equipe entrará em contato com os próximos passos.
                """)),
            Def(
                CandidateEmailTemplateCodes.PreAdmissaoLink,
                "Pré-admissão — link do formulário",
                "Convite para preencher dados/documentos de admissão.",
                ["CandidatoNome", "EmpresaNome", "UrlPreAdmissao"],
                "Preencha seus dados para admissão — {{EmpresaNome}}",
                """
                <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
                  <h2 style="color:#1a1a1a;text-align:center;">Bem-vindo(a), {{CandidatoNome}}!</h2>
                  <p style="color:#555;text-align:center;">Você foi aprovado(a) e precisa preencher seus dados para admissão.</p>
                  <p style="text-align:center;margin:24px 0;">
                    <a href="{{UrlPreAdmissao}}" style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Começar agora</a>
                  </p>
                  <p style="color:#999;font-size:12px;text-align:center;">Ou copie o link:<br/><a href="{{UrlPreAdmissao}}">{{UrlPreAdmissao}}</a></p>
                  <p style="color:#999;font-size:11px;text-align:center;">Atenciosamente, Equipe RH — {{EmpresaNome}}</p>
                </div>
                """),
            Def(
                CandidateEmailTemplateCodes.PreAdmissaoReenvioDocumentos,
                "Pré-admissão — reenvio de documentos",
                "Solicitação de reenvio de documentos pendentes.",
                ["CandidatoNome", "EmpresaNome", "UrlPreAdmissao", "DocumentosPendentes", "Observacao"],
                "Reenvie documentos da admissão — {{EmpresaNome}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Precisamos que você reenvie os seguintes documentos: {{DocumentosPendentes}}
                Observação: {{Observacao}}
                Acesse: {{UrlPreAdmissao}}
                Equipe RH — {{EmpresaNome}}
                """)),
            Def(
                CandidateEmailTemplateCodes.PreAdmissaoCriarUsuario,
                "Pré-admissão — boas-vindas e senha",
                "Usuário criado no portal com senha temporária.",
                ["CandidatoNome", "EmpresaNome", "SenhaTemporaria", "UrlPreAdmissao"],
                "Seu acesso ao portal de admissão — {{EmpresaNome}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Criamos seu acesso ao portal de admissão da {{EmpresaNome}}.
                Senha temporária: {{SenhaTemporaria}}
                Acesse: {{UrlPreAdmissao}}
                Recomendamos alterar a senha no primeiro acesso.
                """)),
            Def(
                CandidateEmailTemplateCodes.AdmissaoPortalOtp,
                "Portal de admissão — código OTP",
                "Código de verificação por e-mail.",
                ["CandidatoNome", "EmpresaNome", "CodigoOtp", "ValidadeMinutos"],
                "Seu código de acesso — {{EmpresaNome}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Seu código de verificação é: {{CodigoOtp}}
                Ele é válido por {{ValidadeMinutos}} minutos.
                Se você não solicitou este código, ignore este e-mail.
                {{EmpresaNome}}
                """)),
            Def(
                CandidateEmailTemplateCodes.SolicitarCompletarDados,
                "Solicitar completar dados do perfil",
                "RH pede atualização de campos do perfil do candidato.",
                ["CandidatoNome", "EmpresaNome", "VagaTitulo", "CamposSolicitados"],
                "Complete seus dados no portal — {{EmpresaNome}}",
                HtmlBody("""
                Olá, {{CandidatoNome}}!
                Para avançarmos no processo da vaga {{VagaTitulo}}, precisamos que você complete os seguintes dados: {{CamposSolicitados}}
                Acesse o portal do candidato e atualize seu perfil.
                Equipe RH — {{EmpresaNome}}
                """)),
        };

        return items.ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);
    }

    private static CandidateEmailTemplateDefinition Def(
        string code,
        string displayName,
        string description,
        IReadOnlyList<string> tags,
        string subject,
        string bodyHtml)
        => new(code, displayName, description, tags, subject.Trim(), bodyHtml.Trim());

    private static string HtmlBody(string plainMultiline)
    {
        var encodedLines = plainMultiline
            .Replace("\r\n", "\n")
            .Trim()
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(l => $"<p>{EscapeKeepingTags(l)}</p>");

        return $"""
               <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
               {string.Join("\n", encodedLines)}
               </div>
               """;
    }

    /// <summary>Escapa HTML preservando tokens {{Tag}}.</summary>
    private static string EscapeKeepingTags(string text)
    {
        var parts = System.Text.RegularExpressions.Regex.Split(text, @"(\{\{[A-Za-z0-9_.]+\}\})");
        return string.Concat(parts.Select(p =>
            p.StartsWith("{{", StringComparison.Ordinal) && p.EndsWith("}}", StringComparison.Ordinal)
                ? p
                : WebUtility.HtmlEncode(p)));
    }
}
