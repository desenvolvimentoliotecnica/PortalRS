namespace RhPortal.Api.Domain.Enums;

public enum TipoDesligamento : short
{
    SemJustaCausa = 0,
    PedidoDemissao = 1,
    AcordoMutuo = 2,
    JustaCausa = 3,
    FimContrato = 4
}

public enum TipoAvisoPrevio : short
{
    Indenizado = 0,
    Trabalhado = 1,
    Dispensado = 2
}
