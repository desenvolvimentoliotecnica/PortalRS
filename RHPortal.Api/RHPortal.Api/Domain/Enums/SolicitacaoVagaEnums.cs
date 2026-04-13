namespace RhPortal.Api.Domain.Enums;

public enum TipoSolicitacaoVaga : short
{
    VagaNova = 0,
    Substituicao = 1
}

public enum StatusAprovacao : short
{
    Pendente  = 0,
    Aprovado  = 1,
    Rejeitado = 2,
    /// <summary>Etapa cancelada junto com a solicitação pai — distinto de Rejeitado por aprovador.</summary>
    Cancelado = 3
}
