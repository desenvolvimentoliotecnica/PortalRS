namespace RhPortal.Api.Domain.Enums;

public enum SolicitacaoStatus : short
{
    Rascunho = 0,
    PendenteAprovacao = 1,
    Aprovada = 2,
    Reprovada = 3,
    AjustesNecessarios = 4,
    PendenteAprovacaoRh = 5,
    Cancelada = 6,
    EmIntegracao = 7,
    Concluida = 8,

    /// <summary>Aprovada pelo fluxo de gestores; RH ainda não tomou a decisão de headcount.</summary>
    AguardandoDecisaoRH = 9,

    /// <summary>RH escalou para aprovação de aumento definitivo de headcount; aguarda aprovador configurável.</summary>
    PendenteAprovacaoAumentoHC = 10,
}
