namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Define QUANDO a ação da etapa é executada.
/// </summary>
public enum MomentoAcao : short
{
    /// <summary>Executa quando o fluxo CHEGA neste step (antes de o aprovador agir).</summary>
    AoChegar = 0,

    /// <summary>Executa quando o aprovador APROVA este step.</summary>
    AoAprovar = 1,
}
