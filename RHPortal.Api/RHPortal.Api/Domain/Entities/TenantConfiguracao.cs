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
    /// Quando true, após a aprovação dos gestores, a solicitação de vaga
    /// requer aprovação de um recrutador/RH antes de gerar a vaga.
    /// Equivalente ao fluxo configurável do SuccessFactors.
    /// </summary>
    public bool RhDeveAprovarAposGestor { get; set; } = false;

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

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
