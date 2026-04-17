namespace RhPortal.Api.Domain.Enums;

public enum TipoFluxoAprovacao : short
{
    RequisicaoPessoal   = 1,
    MovimentacaoPessoal = 2,
    Desligamento        = 3,
    Ferias              = 4,
    Beneficio           = 5,
    Dependente          = 6,
    Endereco            = 7,

    /// <summary>Fluxo configurável para aprovação de aumento definitivo de headcount (escalado pelo RH à Diretoria).</summary>
    AumentoHeadcount    = 8
}
