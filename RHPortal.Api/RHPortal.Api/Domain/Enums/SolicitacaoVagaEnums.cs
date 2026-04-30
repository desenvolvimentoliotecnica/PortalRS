namespace RhPortal.Api.Domain.Enums;

public enum TipoSolicitacaoVaga : short
{
    VagaNova = 0,
    Substituicao = 1,

    /// <summary>
    /// Aumento de quadro dedicado ao fluxo integrado ao RM / portal (milestone vagas RN02).
    /// Comportamento de headcount/decisões alinha-se a <see cref="TipoSolicitacaoVaga.VagaNova"/> no serviço de aplicação.
    /// </summary>
    AumentoQuadro = 2,
}

public enum StatusAprovacao : short
{
    Pendente  = 0,
    Aprovado  = 1,
    Rejeitado = 2,
    /// <summary>Etapa cancelada junto com a solicitação pai — distinto de Rejeitado por aprovador.</summary>
    Cancelado = 3
}
