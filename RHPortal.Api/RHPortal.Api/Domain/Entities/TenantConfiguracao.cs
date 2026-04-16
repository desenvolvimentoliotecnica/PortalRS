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

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
