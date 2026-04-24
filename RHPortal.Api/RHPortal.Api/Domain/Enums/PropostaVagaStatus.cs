namespace RhPortal.Api.Domain.Enums;

/// <summary>Status do ciclo de vida de uma proposta de vaga (carta de oferta digital).</summary>
public enum PropostaVagaStatus : short
{
    Rascunho = 0,
    Enviada = 1,
    Visualizada = 2,
    Aceita = 3,
    Recusada = 4,
    Expirada = 5,
    Cancelada = 6,
}
