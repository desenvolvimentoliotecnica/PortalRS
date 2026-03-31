namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Status compartilhado para todas as solicitações RH (desligamento, promoção, férias, benefício, dependente, endereço).
/// </summary>
public enum SolicitacaoStatus : short
{
    Rascunho = 0,
    PendenteAprovacao = 1,
    Aprovada = 2,
    Reprovada = 3,
    AjustesNecessarios = 4,
    Cancelada = 5
}
