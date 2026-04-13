namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Define qual unidade de lotação é usada como referência ao resolver
/// aprovadores do tipo ResponsavelUnidade, ResponsavelUnidadePai e ResponsavelUnidadeRaiz.
/// </summary>
public enum ReferenciaUnidade : short
{
    /// <summary>Usa a lotação do funcionário que está registrando a solicitação (padrão).</summary>
    Solicitante = 0,

    /// <summary>Usa a lotação informada no próprio formulário da solicitação.</summary>
    SolicitacaoInformada = 1,
}
