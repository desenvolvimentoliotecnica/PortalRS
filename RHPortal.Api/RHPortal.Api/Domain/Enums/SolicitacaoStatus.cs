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

    // 9 = AguardandoDecisaoRH foi removido: a decisão de headcount agora é feita pelo gestor na criação.
    // O valor numérico 9 fica reservado/desativado; registros antigos foram migrados pra Aprovada (2)
    // na migration 20260423_RemoveAguardandoDecisaoRH. Não reutilizar 9.

    /// <summary>Aprovação de aumento definitivo de headcount; aguarda aprovador configurável (Diretoria).</summary>
    PendenteAprovacaoAumentoHC = 10,
}
