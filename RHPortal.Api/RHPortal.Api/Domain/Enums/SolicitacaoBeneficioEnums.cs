namespace RhPortal.Api.Domain.Enums;

public enum TipoBeneficio : short
{
    ValeRefeicao = 0,
    ValeAlimentacao = 1,
    PlanoSaude = 2,
    PlanoOdontologico = 3,
    ValeTransporte = 4,
    SeguroVida = 5,
    AuxilioCreche = 6,
    Gympass = 7,
    Outro = 8
}

public enum TipoAlteracaoBeneficio : short
{
    Inclusao = 0,
    Exclusao = 1,
    AlteracaoPlano = 2
}
