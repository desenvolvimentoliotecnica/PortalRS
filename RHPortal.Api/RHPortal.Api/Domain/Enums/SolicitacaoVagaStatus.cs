namespace RhPortal.Api.Domain.Enums;

public enum SolicitacaoVagaStatus : short
{
    Rascunho = 0,
    PendenteAprovacao = 1,
    Aprovada = 2,
    Reprovada = 3,
    AjustesNecessarios = 4,

    /// <summary>
    /// Gestores aprovaram; aguarda aprovação do RH antes de gerar a vaga.
    /// Habilitado quando TenantConfiguracao.RhDeveAprovarAposGestor = true.
    /// </summary>
    PendenteAprovacaoRh = 5,

    /// <summary>Cancelada pelo solicitante antes de ser aprovada.</summary>
    Cancelada = 6
}
