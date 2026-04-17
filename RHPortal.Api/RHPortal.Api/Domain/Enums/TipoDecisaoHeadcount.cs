namespace RhPortal.Api.Domain.Enums;

public enum TipoDecisaoHeadcount : short
{
    /// <summary>Alguém está saindo; o headcount provisório cobre o período de transição.</summary>
    SubstituicaoProvisoria = 1,

    /// <summary>Aumento real de headcount; requer aprovação pela Diretoria via FluxoAprovacaoConfig.</summary>
    AumentoDefinitivo = 2
}
