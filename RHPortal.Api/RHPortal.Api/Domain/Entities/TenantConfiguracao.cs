namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Configurações gerais do tenant que afetam o fluxo de recrutamento.
/// Um único registro por tenant (upsert via TenantConfiguracaoService).
/// </summary>
public sealed class TenantConfiguracao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>
    /// Quando true, envia e-mail ao gestor requisitante e ao recrutador responsável
    /// quando um candidato se candidata a uma vaga pelo portal público.
    /// Default false — notificação suprimida até o tenant habilitar.
    /// </summary>
    public bool EnviarEmailResponsavelNaCandidatura { get; set; } = false;

    /// <summary>
    /// Quando true, após a aprovação dos gestores, a solicitação de vaga
    /// requer aprovação de um recrutador/RH antes de gerar a vaga.
    /// Equivalente ao fluxo configurável do SuccessFactors.
    /// </summary>
    public bool RhDeveAprovarAposGestor { get; set; } = false;

    /// <summary>
    /// Quando true, requisições de vaga são consideradas originadas do RM já aprovadas.
    /// O Portal mantém rastreabilidade, mas oculta criação/aprovação interna e materializa
    /// vagas a partir da sincronização RM.
    /// </summary>
    public bool RequisicoesVagaOrigemRm { get; set; } = true;

    /// <summary>
    /// Quando true, o worker automático importa periodicamente requisições RM e materializa
    /// vagas aprovadas sem ação manual.
    /// </summary>
    public bool RmImportacaoAutomaticaAtiva { get; set; } = false;

    /// <summary>Intervalo, em minutos, entre ciclos automáticos de importação RM.</summary>
    public int RmImportacaoAutomaticaIntervaloMinutos { get; set; } = 15;

    /// <summary>Quantidade máxima de requisições RM lidas por ciclo automático.</summary>
    public int RmImportacaoAutomaticaMaxPorExecucao { get; set; } = 50;

    /// <summary>
    /// Funcionário RH designado como aprovador da etapa de RH.
    /// Null = não há aprovador fixo (qualquer admin/recrutador pode aprovar via endpoint).
    /// </summary>
    public Guid? AprovadorRhId { get; set; }
    public Funcionario? AprovadorRh { get; set; }

    // --------------------
    // Gestão de Headcount
    // --------------------

    /// <summary>
    /// Número de dias que o headcount provisório (originado de substituição) permanece ativo
    /// antes de expirar automaticamente. Default = 30.
    /// </summary>
    public int DiasProvisaoSubstituicao { get; set; } = 30;

    /// <summary>
    /// Número de dias que uma vaga pode ficar aberta sem ser preenchida
    /// antes de o RH receber um alerta no painel. Default = 60.
    /// </summary>
    public int DiasAlertaVagaSemFill { get; set; } = 60;

    // --------------------
    // SLA de Aprovação
    // --------------------

    /// <summary>
    /// Tempo em horas após o qual uma etapa pendente gera lembrete automático para o aprovador.
    /// Pode ser sobrescrito por EtapaConfigAprovacao.SlaHoras. Default = 48h.
    /// </summary>
    public int SlaAprovacaoHoras { get; set; } = 48;

    /// <summary>
    /// Tempo em horas após o qual uma etapa pendente é escalada para o gestor do aprovador.
    /// Deve ser maior que SlaAprovacaoHoras. Default = 96h.
    /// </summary>
    public int SlaEscalacaoHoras { get; set; } = 96;

    // --------------------
    // Política Salarial
    // --------------------

    /// <summary>
    /// Quando true, bloqueia a aprovação de movimentações com salário fora da faixa
    /// configurada (FaixaSalarial). Default = false (apenas marca flag ForaFaixaSalarial
    /// e notifica RH, mas não bloqueia a aprovação).
    /// </summary>
    public bool BloqueiaSalarioForaFaixa { get; set; } = false;

    // --------------------
    // Integração Blip (WhatsApp)
    // --------------------

    /// <summary>Número hospedeiro do bot Blip no WhatsApp (ex: 5511999999999).</summary>
    public string? BlipNumeroHospedeiro { get; set; }

    /// <summary>URL da API de mensagens do bot Blip (ex: https://tenant.http.msging.net/messages).</summary>
    public string? BlipApiUrl { get; set; }

    /// <summary>Chave de autorização do bot Blip (valor após "Key " no header Authorization).</summary>
    public string? BlipApiKey { get; set; }

    // --------------------
    // Integração RM — criação de requisições de pessoal
    // --------------------

    /// <summary>
    /// URL completa do endpoint de criação de requisições RM.
    /// Ex.: <c>http://localhost:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData</c>.
    /// </summary>
    public string? RmRequisicaoCreateEndpointUrl { get; set; }

    /// <summary>
    /// URL completa/template do endpoint GET de consulta de requisições RM.
    /// Ex.: <c>http://host/api/framework/v1/consultaSQLServer/RealizaConsulta/KNG.V.003/0/V/?parameters=COLIGADA={COLIGADA};IDREQ={IDREQ}</c>.
    /// </summary>
    public string? RmRequisicaoGetEndpointUrl { get; set; }

    /// <summary>
    /// URL completa/template do endpoint RM de pareceres/aprovações da requisição.
    /// Ex.: <c>http://host/RMSRestDataServer/rest/RhuReqAumentoQuadroParecerData?limit=50&amp;filter=["IDREQ= :P1 AND CODCOLREQUISICAO=:P2","{IDREQ}","{COLIGADA}"]</c>.
    /// </summary>
    public string? RmRequisicaoParecerEndpointUrl { get; set; }

    /// <summary>Usuário de autenticação BasicAuth para o endpoint RM de criação.</summary>
    public string? RmRequisicaoCreateUsername { get; set; }

    /// <summary>Senha de autenticação BasicAuth para o endpoint RM de criação.</summary>
    public string? RmRequisicaoCreatePassword { get; set; }

    // --------------------
    // Integração Azure AD
    // --------------------

    /// <summary>
    /// Azure AD / Entra Tenant ID do cliente para integração de off-boarding.
    /// Quando preenchido, o sistema desativa a conta Azure AD do funcionário desligado.
    /// </summary>
    public string? AzureAdTenantId { get; set; }

    /// <summary>App Registration Client ID com permissões User.EnableDisableAccount.All e User.RevokeSessions.All.</summary>
    public string? AzureAdClientId { get; set; }

    /// <summary>Client Secret do App Registration (armazenar criptografado em produção).</summary>
    public string? AzureAdClientSecret { get; set; }

    // --------------------
    // Microsoft Graph — Agenda (Outlook)
    // --------------------

    /// <summary>Azure AD Tenant ID para leitura de calendário via Microsoft Graph.</summary>
    public string? GraphCalendarTenantId { get; set; }

    /// <summary>App Registration Client ID com permissão Calendars.ReadWrite (application).</summary>
    public string? GraphCalendarClientId { get; set; }

    /// <summary>Client Secret criptografado do App Registration.</summary>
    public string? GraphCalendarClientSecretEncrypted { get; set; }

    /// <summary>UPN usado no botão de teste da integração Graph (não define a agenda de todos os usuários).</summary>
    public string? GraphCalendarUserUpn { get; set; }

    /// <summary>Quando true, eventos do Outlook são exibidos na agenda do portal.</summary>
    public bool GraphCalendarEnabled { get; set; }

    // --------------------
    // IA — Seleção de provider por tenant (Fase 3 LLM-agnóstico, 2026-04-25)
    // --------------------

    /// <summary>
    /// Provider de LLM (chat) ativo para este tenant. Valores aceitos:
    /// <c>"openai"</c>, <c>"gemini"</c>, <c>"anthropic"</c>, <c>"ollama"</c>.
    /// <c>null</c> → herda <c>Ai.DefaultProvider</c> do appsettings.
    /// </summary>
    public string? LlmProvider { get; set; }

    /// <summary>
    /// Modelo de chat específico (override). Quando <c>null</c>, usa o
    /// <c>DefaultModel</c> da seção <c>Ai.{Provider}</c> do appsettings.
    /// Exemplos: <c>"gpt-4o-mini"</c>, <c>"gemini-2.5-flash"</c>,
    /// <c>"claude-3-5-sonnet-20241022"</c>, <c>"qwen2.5:7b"</c>.
    /// </summary>
    public string? LlmModel { get; set; }

    /// <summary>
    /// Provider de embeddings ativo para este tenant.
    /// Mesmas opções do <c>LlmProvider</c>. <c>null</c> = herda do global.
    /// </summary>
    public string? EmbeddingProvider { get; set; }

    /// <summary>
    /// Modelo de embeddings específico (override). Exemplos:
    /// <c>"text-embedding-3-small"</c>, <c>"models/gemini-embedding-001"</c>,
    /// <c>"bge-m3"</c>.
    /// </summary>
    public string? EmbeddingModel { get; set; }

    /// <summary>
    /// Quando <c>true</c>, o parse de CV no Novo Candidato tenta IA antes da heurística.
    /// Default <c>true</c>. Desligar em /admin/ia mantém só o extrator determinístico.
    /// </summary>
    public bool UsarIaParseCurriculo { get; set; } = true;

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
