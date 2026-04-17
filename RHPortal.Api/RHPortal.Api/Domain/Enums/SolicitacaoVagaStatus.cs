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
    Cancelada = 6,

    /// <summary>RH/Admin acionou "Efetivar" — enviando requisição ao TOTVS ERP.</summary>
    EmIntegracao = 7,

    /// <summary>TOTVS confirmou recebimento da requisição — vaga foi aberta automaticamente.</summary>
    Concluida = 8,

    /// <summary>VagaNova aprovada pelo fluxo de gestores; RH ainda não tomou a decisão de headcount.</summary>
    AguardandoDecisaoRH = 9,

    /// <summary>RH escalou para aprovação de aumento definitivo de headcount; aguarda aprovação configurável.</summary>
    PendenteAprovacaoAumentoHC = 10
}
