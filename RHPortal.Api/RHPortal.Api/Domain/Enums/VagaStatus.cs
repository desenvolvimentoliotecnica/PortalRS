namespace RHPortal.Api.Domain.Enums
{
    public enum VagaStatus : short
    {
        NaoInformado = 0,
        Rascunho = 1,
        Aberta = 2,
        Pausada = 3,
        EmTriagem = 4,
        EmEntrevistas = 5,
        EmOferta = 6,
        Encerrada = 7,
        Cancelada = 8,
        /// <summary>Posição estrutural já preenchida (gerada via carga inicial). Não aparece no quadro de recrutamento.</summary>
        Preenchida = 9
    }
}
